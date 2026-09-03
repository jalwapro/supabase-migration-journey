#!/usr/bin/env python3
"""Create an OCI VM.Standard.A1.Flex instance and retry capacity failures.

Credentials are supplied through environment variables by GitHub Actions.
The script intentionally does not print the private key or other credentials.
"""

import os
import sys
import time

import oci
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


def build_signer():
    tenancy = required("OCI_TENANCY_OCID")
    user = required("OCI_USER_OCID")
    fingerprint = required("OCI_FINGERPRINT")
    private_key = required("OCI_PRIVATE_KEY")

    return oci.signer.Signer(
        tenancy=tenancy,
        user=user,
        fingerprint=fingerprint,
        private_key_file_location=None,
        private_key_content=private_key,
    )


def is_capacity_error(exc: Exception) -> bool:
    if not isinstance(exc, ServiceError):
        return False

    text = f"{exc.status} {exc.code} {exc.message}".lower()
    return (
        "out of host capacity" in text
        or "outofhostcapacity" in text
        or "out of capacity" in text
        or "capacity" in text and exc.status in (409, 429, 500, 503)
    )


def find_availability_domain(identity, compartment_id: str) -> str:
    ads = oci.pagination.list_call_get_all_results(
        identity.list_availability_domains, compartment_id
    ).data
    if not ads:
        raise RuntimeError("No OCI availability domain was found")
    return ads[0].name


def find_image(compute, compartment_id: str):
    """Find a recent ARM64 Ubuntu image usable by VM.Standard.A1.Flex."""
    images = oci.pagination.list_call_get_all_results(
        compute.list_images,
        compartment_id=compartment_id,
        shape=SHAPE,
        sort_by="TIMECREATED",
        sort_order="DESC",
        operating_system="Canonical Ubuntu",
    ).data

    arm_images = [
        image
        for image in images
        if str(getattr(image, "architecture", "")).lower() in ("aarch64", "arm64")
    ]
    candidates = arm_images or images
    if not candidates:
        raise RuntimeError(
            "No Ubuntu image was found for VM.Standard.A1.Flex in the compartment. "
            "Set OCI_IMAGE_OCID to an ARM64 image OCID if automatic discovery is unavailable."
        )
    return candidates[0]


def create_instance():
    region = required("OCI_REGION")
    compartment_id = required("OCI_COMPARTMENT_OCID")
    subnet_id = required("OCI_SUBNET_OCID")

    config = {
        "user": required("OCI_USER_OCID"),
        "fingerprint": required("OCI_FINGERPRINT"),
        "tenancy": required("OCI_TENANCY_OCID"),
        "region": region,
    }

    signer = build_signer()
    identity = oci.identity.IdentityClient(config, signer=signer)
    compute = oci.core.ComputeClient(config, signer=signer)
    virtual_network = oci.core.VirtualNetworkClient(config, signer=signer)

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

    # Validate that the subnet exists and belongs to the supplied compartment/tenancy.
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
        f"in {availability_domain} (region {region})"
    )

    response = compute.launch_instance(launch_details)
    instance = response.data
    print("SUCCESS: OCI Ampere instance created")
    print(f"Instance OCID: {instance.id}")
    print(f"Display name: {instance.display_name}")
    print(f"Lifecycle state: {instance.lifecycle_state}")
    return True


def main():
    print("Starting OCI VM.Standard.A1.Flex capacity retry...")
    while True:
        try:
            if create_instance():
                return 0
        except ServiceError as exc:
            if is_capacity_error(exc):
                print(
                    "OCI reported Out of host capacity. "
                    f"Retrying in {RETRY_SECONDS} seconds..."
                )
                time.sleep(RETRY_SECONDS)
                continue
            print(
                f"OCI API error (not a capacity error): status={exc.status}, "
                f"code={exc.code}, message={exc.message}",
                file=sys.stderr,
            )
            return 1
        except Exception as exc:
            print(f"Fatal error: {exc}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
