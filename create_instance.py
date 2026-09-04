#!/usr/bin/env python3
"""Create an OCI VM.Standard.A1.Flex instance and retry transient failures."""

import hashlib
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

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
    value = value.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n")
    value = value.strip()
    if not value:
        raise RuntimeError("OCI_PRIVATE_KEY is empty")
    return value + "\n"


def fingerprint_from_private_key(private_key: str) -> str:
    try:
        key = serialization.load_pem_private_key(private_key.encode("utf-8"), password=None)
    except Exception as exc:
        raise RuntimeError("OCI_PRIVATE_KEY is not a valid unencrypted PEM private key") from exc
    public_der = key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    digest = hashlib.md5(public_der).hexdigest()
    return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))


def fingerprint_from_public_key(public_key: str) -> str:
    try:
        key = serialization.load_pem_public_key(public_key.encode("utf-8"))
    except Exception as exc:
        raise RuntimeError("OCI_PUBLIC_KEY is not a valid PEM public key") from exc
    public_der = key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    digest = hashlib.md5(public_der).hexdigest()
    return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))


def build_oci_clients():
    private_key = normalize_private_key(required("OCI_PRIVATE_KEY"))
    configured_fingerprint = required("OCI_FINGERPRINT").strip().lower()
    derived_fingerprint = fingerprint_from_private_key(private_key).lower()

    print(f"OCI API key fingerprint check: configured={configured_fingerprint}")
    print(f"OCI API key fingerprint check: private-key={derived_fingerprint}")
    if configured_fingerprint != derived_fingerprint:
        raise RuntimeError(
            "OCI_FINGERPRINT does not match OCI_PRIVATE_KEY. "
            f"Configured fingerprint: {configured_fingerprint}; private-key fingerprint: {derived_fingerprint}."
        )

    optional_public_key = os.getenv("OCI_PUBLIC_KEY", "").strip()
    if optional_public_key:
        public_fingerprint = fingerprint_from_public_key(optional_public_key).lower()
        print(f"OCI API public-key fingerprint check: public-key={public_fingerprint}")
        if public_fingerprint != derived_fingerprint:
            raise RuntimeError(
                "OCI_PUBLIC_KEY does not match OCI_PRIVATE_KEY. "
                f"Public-key fingerprint: {public_fingerprint}; private-key fingerprint: {derived_fingerprint}."
            )

    key_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as key_file:
            key_path = key_file.name
            key_file.write(private_key)
        os.chmod(key_path, 0o600)

        config = {
            "user": required("OCI_USER_OCID"),
            "fingerprint": configured_fingerprint,
            "tenancy": required("OCI_TENANCY_OCID"),
            "region": required("OCI_REGION"),
            "key_file": key_path,
        }
        oci.config.validate_config(config)

        signer = oci.signer.Signer(
            config["tenancy"],
            config["user"],
            config["fingerprint"],
            key_path,
        )
        identity = oci.identity.IdentityClient(config, signer=signer)
        compute = oci.core.ComputeClient(config, signer=signer)
        virtual_network = oci.core.VirtualNetworkClient(config, signer=signer)
        return identity, compute, virtual_network, key_path
    except Exception:
        if key_path:
            try:
                os.unlink(key_path)
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


def is_auth_error(exc: Exception) -> bool:
    return isinstance(exc, ServiceError) and exc.status == 401 and str(exc.code).lower() == "notauthenticated"


def verify_oci_auth(identity):
    print("Verifying OCI API authentication...")
    print(f"Runner UTC time: {datetime.now(timezone.utc).isoformat()}")
    try:
        user = identity.get_user(required("OCI_USER_OCID")).data
    except ServiceError as exc:
        if exc.status == 401:
            request_id = getattr(exc, "opc_request_id", None) or "not returned"
            raise RuntimeError(
                "OCI authentication failed with 401 NotAuthenticated. "
                "The private-key fingerprint matches OCI_FINGERPRINT. "
                "The PEM public key supplied for this key also has the same fingerprint when OCI_PUBLIC_KEY is set. "
                "The remaining OCI-side checks are that this exact public key is registered under OCI_USER_OCID, "
                "OCI_USER_OCID is the same user shown in the API-key configuration snippet, and the runner clock "
                "is within OCI's allowed skew. "
                f"OCI code={exc.code}; request_id={request_id}; runner_utc={datetime.now(timezone.utc).isoformat()}"
            ) from exc
        raise
    print(f"OCI authentication OK for user: {user.name}")


def find_availability_domain(identity, compartment_id: str) -> str:
    print("Querying OCI availability domains...")
    ads = oci.pagination.list_call_get_all_results(identity.list_availability_domains, compartment_id).data
    if not ads:
        raise RuntimeError("No OCI availability domain was found")
    return ads[0].name


def find_image(compute, compartment_id: str):
    print("Querying Ubuntu ARM64 images...")
    images = oci.pagination.list_call_get_all_results(
        compute.list_images,
        compartment_id=compartment_id,
        shape=SHAPE,
        sort_by="TIMECREATED",
        sort_order="DESC",
        operating_system="Canonical Ubuntu",
    ).data
    arm_images = [image for image in images if str(getattr(image, "architecture", "")).lower() in ("aarch64", "arm64")]
    candidates = arm_images or images
    if not candidates:
        raise RuntimeError("No Ubuntu ARM64 image found for VM.Standard.A1.Flex")
    return candidates[0]


def create_instance():
    compartment_id = required("OCI_COMPARTMENT_OCID")
    subnet_id = required("OCI_SUBNET_OCID")
    identity, compute, virtual_network, key_path = build_oci_clients()
    try:
        verify_oci_auth(identity)
        availability_domain = os.getenv("OCI_AVAILABILITY_DOMAIN") or find_availability_domain(identity, compartment_id)
        image_ocid = os.getenv("OCI_IMAGE_OCID")
        if image_ocid:
            image_id = image_ocid
        else:
            image = find_image(compute, compartment_id)
            image_id = image.id
            print(f"Using discovered Ubuntu image: {image.display_name} ({image.id})")

        print("Checking OCI subnet access...")
        subnet = virtual_network.get_subnet(subnet_id).data
        print(f"Using subnet: {subnet.display_name} ({subnet.id})")

        display_name = os.getenv("OCI_INSTANCE_NAME", "jalwa-ampere-a1")
        ssh_public_key = os.getenv("OCI_SSH_PUBLIC_KEY", "").strip()
        launch_details = oci.core.models.LaunchInstanceDetails(
            availability_domain=availability_domain,
            compartment_id=compartment_id,
            display_name=display_name,
            shape=SHAPE,
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=OCPUS, memory_in_gbs=MEMORY_GBS),
            create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=subnet_id, assign_public_ip=True),
            source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image_id, boot_volume_size_in_gbs=50),
        )
        if ssh_public_key:
            launch_details.metadata = {"ssh_authorized_keys": ssh_public_key}

        print(f"Attempting {SHAPE}: {OCPUS} OCPUs / {MEMORY_GBS} GB RAM in {availability_domain} (region {required('OCI_REGION')})")
        instance = compute.launch_instance(launch_details).data
        print("SUCCESS: OCI Ampere instance created")
        print(f"Instance OCID: {instance.id}")
        print(f"Display name: {instance.display_name}")
        print(f"Lifecycle state: {instance.lifecycle_state}")
        return True
    finally:
        try:
            os.unlink(key_path)
        except OSError:
            pass


def main():
    print("Starting OCI VM.Standard.A1.Flex capacity/auth retry...")
    while True:
        try:
            if create_instance():
                return 0
        except ServiceError as exc:
            if is_capacity_error(exc):
                print(f"OCI reported Out of host capacity. Retrying in {RETRY_SECONDS} seconds...")
                time.sleep(RETRY_SECONDS)
                continue
            if is_auth_error(exc):
                print(
                    "OCI returned 401 NotAuthenticated. Retrying in 60 seconds so the workflow can recover "
                    "automatically after the OCI API key is corrected/registered."
                )
                time.sleep(RETRY_SECONDS)
                continue
            print(f"OCI API error: status={exc.status}, code={exc.code}, message={exc.message}", file=sys.stderr)
            return 1
        except RuntimeError as exc:
            text = str(exc)
            if "OCI authentication failed with 401 NotAuthenticated" in text:
                print(f"{text}", file=sys.stderr)
                print(
                    "The workflow will retry authentication every 60 seconds. "
                    "Register the matching PEM public key under the exact OCI_USER_OCID, then the same run can continue."
                )
                time.sleep(RETRY_SECONDS)
                continue
            print(f"Fatal error: {exc}", file=sys.stderr)
            return 1
        except Exception as exc:
            print(f"Fatal error: {exc}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
