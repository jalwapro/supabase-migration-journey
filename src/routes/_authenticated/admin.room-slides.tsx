import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminRoomSlidesManager } from "@/components/admin/AdminRoomSlidesManager";

export const Route = createFileRoute("/_authenticated/admin/room-slides")({
  component: RoomSlidesAdmin,
});

function RoomSlidesAdmin() {
  return (
    <>
      <AdminPageHeader title="Voice Room Slides" subtitle="Manage slides shown in voice rooms" />
      <AdminRoomSlidesManager />
    </>
  );
}
