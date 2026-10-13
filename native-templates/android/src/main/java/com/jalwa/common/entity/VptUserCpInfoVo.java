package com.jalwa.common.entity;

/** Read model for a user's current JALWA CP partner and progress. */
public class VptUserCpInfoVo {
    private String cpUserId;
    private String cpNickname;
    private String cpIcon;
    private long nowGrowthValue;
    private int currentLevel;
    private long becomeCpTime;

    public String getCpUserId() { return cpUserId; }
    public void setCpUserId(String cpUserId) { this.cpUserId = cpUserId; }

    public String getCpNickname() { return cpNickname; }
    public void setCpNickname(String cpNickname) { this.cpNickname = cpNickname; }

    public String getCpIcon() { return cpIcon; }
    public void setCpIcon(String cpIcon) { this.cpIcon = cpIcon; }

    public long getNowGrowthValue() { return nowGrowthValue; }
    public void setNowGrowthValue(long nowGrowthValue) { this.nowGrowthValue = nowGrowthValue; }

    public int getCurrentLevel() { return currentLevel; }
    public void setCurrentLevel(int currentLevel) { this.currentLevel = currentLevel; }

    public long getBecomeCpTime() { return becomeCpTime; }
    public void setBecomeCpTime(long becomeCpTime) { this.becomeCpTime = becomeCpTime; }
}
