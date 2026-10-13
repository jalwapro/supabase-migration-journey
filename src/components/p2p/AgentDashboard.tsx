// Diamond Payout Handling Section within Normal Agent Dashboard
const [proofFile, setProofFile] = useState<File | null>(null);
const [uploadingSlip, setUploadingSlip] = useState(false);

async function submitDiamondPayoutSlip(requestId: string) {
  if (!proofFile) {
    toast.error("Please attach payment screenshot/slip first!");
    return;
  }
  setUploadingSlip(true);
  try {
    // 1. Upload Slip to Cloudflare R2 via your standard uploadPrivateToUserFolder
    const slipUrl = await uploadPrivateToUserFolder("payout-slips", proofFile, user.id);
    
    // 2. Submit Slip to DB -> Status changes to 'slip_submitted'
    const { error } = await supabase
      .from("diamond_payout_requests")
      .update({
        payout_slip_url: slipUrl,
        status: "slip_submitted",
        agent_paid_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) throw error;
    toast.success("Receipt attached! Sent to Super Agent for verification.");
    setProofFile(null);
  } catch (err: any) {
    toast.error(err.message || "Failed to attach slip");
  } finally {
    setUploadingSlip(false);
  }
}
