package com.jalwa.common.entity;

/** Request payload model for a JALWA CP proposal. */
public class VptApplyCpEntity {
    private String senderId;
    private String receiverId;
    private int cpType;
    private String giftImg;

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getReceiverId() { return receiverId; }
    public void setReceiverId(String receiverId) { this.receiverId = receiverId; }

    public int getCpType() { return cpType; }
    public void setCpType(int cpType) { this.cpType = cpType; }

    public String getGiftImg() { return giftImg; }
    public void setGiftImg(String giftImg) { this.giftImg = giftImg; }
}
