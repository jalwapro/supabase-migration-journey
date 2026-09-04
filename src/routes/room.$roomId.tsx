import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { VipBadge } from "@/components/vip/VipBadge";
import { vipTierForLevel } from "@/lib/vip-levels";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoomState, RoomParticipant, RoomSeat } from "@/types/room";
import { VoiceRoomScreen } from "@/components/voice-room/VoiceRoomScreen";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultBgOpacity } from "@/hooks/useDefaultBgOpacity";
import { resolveLuxuryGiftMp4Url } from "@/lib/luxuryGiftMp4";
import { frameForLevel } from "@/lib/levelFrames";
import hostThroneAsset from "@/assets/room/host-throne.png.asset.json";
import { resolveAssetUrl } from "@/lib/assetUrl";
const HOST_THRONE_URL = resolveAssetUrl(hostThroneAsset.url)!;

import { useLiveKitRoom as useAgoraRoom, type RemoteUser, type RemoteVideoTrack } from "@/hooks/useLiveKitRoom";
import { useRoomHeartbeat } from "@/hooks/useRoomHeartbeat";
import { RoomDiagnostics } from "@/components/room/RoomDiagnostics";
