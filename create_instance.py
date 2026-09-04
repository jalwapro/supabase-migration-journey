#!/usr/bin/env python3
"""Create an OCI VM.Standard.A1.Flex instance and retry capacity failures."""

import hashlib
import os
import sys
import tempfile
import time

import oci
from cryptography.hazmat.primitives import serialization
from oci.exceptions import ServiceError

RETRY_SECONDS = 60
SHAPE = "VM.Standard.A1.Flex"
OCPUS = 2
MEMORY_GBS = 12


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_private_key(value: str) -> str:
    """Normalize a PEM secret copied through GitHub without exposing its contents."""
    value = value.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n")
    value = value.strip()
    if not value:
        raise RuntimeError("OCI_PRIVATE_KEY is empty")
    return value + "\n"


def fingerprint_from_private_key(private_key: str) -> str:
    """Return OCI-style MD5 fingerprint of the SSH/RSA public key in the PEM."""
    try:
        key = serialization.load_pem_private_key(
            private_key.encode("utf-8"), password=None
        )
    except Exception as exc:
        raise RuntimeError(
            "OCI_PRIVATE_KEY is not a valid unencrypted PEM private key"
        ) from exc

    public_der = key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    digest = hashlib.md5(public_der).hexdigest()
    return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))


def build_oci_clients():
    """Build OCI clients using the API private key supplied by GitHub Secrets."""
    private_key = normalize_private_key(required("OCI_PRIVATE_KEY"))
    configured_fingerprint = required("OCI_FINGERPRINT").strip().lower()
    derived_fingerprint = fingerprint_from_private_key(private_key).lower()

    if configured_fingerprint != derived_fingerprint:
        raise RuntimeError(
            "OCI_FINGERPRINT does not match OCI_PRIVATE_KEY. "
            f"Configured fingerprint: {configured_fingerprint}; "
            f"private-key fingerprint: {derived_fingerprint}. "
            "Update the GitHub OCI_FINGERPRINT secret to the fingerprint of this API key."
        )

    key_file = tempfile.NamedTemporaryFile(
        mode="w", prefix="oci-api-", suffix=".pem", delete=False
    )
    try:
        key_file.write(private_key)
        key_file.flush()
        os.chmod(key_file.name, 0o600)
    finally:
        key_file.close()

    config = {
        "user": required("OCI_USER_OCID"),
        "fingerprint": required("OCI_FINGERPRINT"),
        "tenancy": required("OCI_TENANCY_OCID"),
        "region": required("OCI_REGION"),
        "key_file": key_file.name,
    }

    try:
        oci.config.validate_config(config)
        signer = oci.signer.Signer(
            tenancy=config["tenancy"],
            user=config["user"],
            fingerprint=config["fingerprint"],
            private_key_file_location=key_file.name,
        )
        identity = oci.identity.IdentityClient(config, signer=signer)
        compute = oci.core.ComputeClient(config, signer=signer)
        virtual_network = oci.core.VirtualNetworkClient(config, signer=signer)
        return identity, compute, virtual_network, key_file.name
    except Exception:
        try:
            os.unlink(key_file.name)
        except OSError:
            pass
        raise


def is_capacity_error(exc: Exception) -> bool:
    if not isinstance(exc, ServiceError):
        return False
    text = f"{exc.status} {exc.code} {exc.message}".lower()
    return (
        "out of host capacity" in text
        or "outofhostcapacity" in text
        or "out of capacity" in text
        or ("capacity" in text and exc.status in (409, 429, 500, 503))
    )


def find_availability_domain(identity, compartment_id: str) -> str:
    ads = oci.pagination.list_call_get_all_results(
        identity.list_availability_domains, compartment_id
    ).data
    if not ads:
        raise RuntimeError("No OCI availability domain was found")
    return ads[0].name


def find_image(compute, compartment_id: str):
    images = oci.pagination.list_call_get_all_results(
        compute.list_images,
        compartment_id=compartment_id,
        shape=SHAPE,
        sort_by="TIMECREATED",
        sort_order="DESC",
        operating_system="Canonical Ubuntu",
    ).data
    arm_images = [
        image for image in images
        if str(getattr(image, "architecture", "")).lower() in ("aarch64", "arm64")
    ]
    candidates = arm_images or images
    if not candidates:
        raise RuntimeError("No Ubuntu ARM64 image found for VM.Standard.A1.Flex")
    return candidates[0]


def create_instance():
    compartment_id = required("OCI_COMPARTMENT_OCID")
    subnet_id = required("OCI_SUBNET_OCID")
    identity, compute, virtual_network, key_file = build_oci_clients()

    try:
        availability_domain = os.getenv("OCI_AVAILABILITY_DOMAIN") or find_availability_domain(
            identity, compartment_id
        )
        image_ocid = os.getenv("OCI_IMAGE_OCID")
        if image_ocid:
            image_id = image_ocid
        else:
            image = find_image(compute, compartment_id)
            image_id = image.id
            print(f"Using discovered Ubuntu image: {image.display_name} ({image.id})")

        subnet = virtual_network.get_subnet(subnet_id).data
        print(f"Using subnet: {subnet.display_name} ({subnet.id})")

        display_name = os.getenv("OCI_INSTANCE_NAME", "jalwa-ampere-a1")
        ssh_public_key = os.getenv("OCI_SSH_PUBLIC_KEY", "").strip()

        launch_details = oci.core.models.LaunchInstanceDetails(
            availability_domain=availability_domain,
            compartment_id=compartment_id,
            display_name=display_name,
            shape=SHAPE,
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                ocpus=OCPUS,
                memory_in_gbs=MEMORY_GBS,
            ),
            create_vnic_details=oci.core.models.CreateVnicDetails(
                subnet_id=subnet_id,
                assign_public_ip=True,
            ),
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                image_id=image_id,
                boot_volume_size_in_gbs=50,
            ),
        )

        if ssh_public_key:
            launch_details.metadata = {"ssh_authorized_keys": ssh_public_key}

        print(
            f"Attempting {SHAPE}: {OCPUS} OCPUs / {MEMORY_GBS} GB RAM "
            f"in {availability_domain} (region {required('OCI_REGION')})"
        )
        instance = compute.launch_instance(launch_details).data
        print("SUCCESS: OCI Ampere instance created")
        print(f"Instance OCID: {instance.id}")
        print(f"Display name: {instance.display_name}")
        print(f"Lifecycle state: {instance.lifecycle_state}")
        return True
    finally:
        try:
            os.unlink(key_file)
        except OSError:
            pass


def main():
    print("Starting OCI VM.Standard.A1.Flex capacity retry...")
    while True:
        try:
            if create_instance():
                return 0
        except ServiceError as exc:
            if is_capacity_error(exc):
                print(
                    f"OCI reported Out of host capacity. "
                    f"Retrying in {RETRY_SECONDS} seconds..."
                )
                time.sleep(RETRY_SECONDS)
                continue
            print(
                f"OCI API error: status={exc.status}, code={exc.code}, "
                f"message={exc.message}",
                file=sys.stderr,
            )
            return 1
        except Exception as exc:
            print(f"Fatal error: {exc}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
