import * as BackupService from "../services/backup.service.js";

export const getBackupStatus = async (req, res) => {
  try {
    const data = await BackupService.getBackupStatus();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Backup status error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri čitanju statusa backupa" });
  }
};
