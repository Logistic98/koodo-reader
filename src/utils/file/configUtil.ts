import SyncService from "../storage/syncService";
import {
  ConfigService,
  CommonTool,
} from "../../assets/lib/kookit-extra-browser.min";
import DatabaseService from "../storage/databaseService";
import SqlUtil from "./sqlUtil";
import { isElectron } from "react-device-detect";
import { getStorageLocation } from "../common";
import { getCloudConfig } from "./common";

class ConfigUtil {
  static async downloadConfig(type: string) {
    let syncUtil = await SyncService.getSyncUtil();
    let jsonBuffer: ArrayBuffer = await syncUtil.downloadFile(
      type + ".json",
      "config"
    );
    let jsonStr = new TextDecoder().decode(jsonBuffer);
    return jsonStr;
  }
  static async uploadConfig(type: string) {
    let config = {};
    if (type === "sync") {
      config = ConfigService.getAllSyncRecord();
    } else {
      let configList = CommonTool.configList;
      for (let i = 0; i < configList.length; i++) {
        let item = configList[i];
        if (localStorage.getItem(item)) {
          config[item] = localStorage.getItem(item);
        }
      }
    }
    let syncUtil = await SyncService.getSyncUtil();
    let configBlob = new Blob([JSON.stringify(config)], {
      type: "application/json",
    });
    await syncUtil.uploadFile(type + ".json", "config", configBlob);
  }
  static async getCloudConfig(type: string) {
    let configStr = await ConfigUtil.downloadConfig(type);
    console.log(configStr, "configStr");
    return JSON.parse(configStr);
  }

  static async getCloudDatabase(database: string) {
    if (isElectron) {
      const { ipcRenderer } = window.require("electron");
      let service = localStorage.getItem("defaultSyncOption");
      if (!service) {
        return;
      }
      let tokenConfig = await getCloudConfig(service);

      await ipcRenderer.invoke("cloud-download", {
        ...tokenConfig,
        fileName: database + ".db",
        service: service,
        type: "config",
        isTemp: true,
        storagePath: getStorageLocation(),
      });
      let cloudRecords = await DatabaseService.getAllRecords(
        "temp-" + database
      );
      await ipcRenderer.invoke("close-database", {
        dbName: "temp-" + database,
        storagePath: getStorageLocation(),
      });
      console.log(cloudRecords, "cloudRecords");
      return cloudRecords;
    } else {
      let syncUtil = await SyncService.getSyncUtil();
      let dbBuffer = await syncUtil.downloadFile(database + ".db", "config");
      let sqlUtil = new SqlUtil();
      let cloudRecords = await sqlUtil.dbBufferToJson(dbBuffer, database);
      console.log(cloudRecords, "cloudRecords");
      return cloudRecords;
    }
  }
  static async uploadDatabase(type: string) {
    if (isElectron) {
      const { ipcRenderer } = window.require("electron");
      await ipcRenderer.invoke("close-database", {
        dbName: type,
        storagePath: getStorageLocation(),
      });
      let service = localStorage.getItem("defaultSyncOption");
      if (!service) {
        return;
      }
      let tokenConfig = await getCloudConfig(service);

      return await ipcRenderer.invoke("cloud-upload", {
        ...tokenConfig,
        fileName: type + ".db",
        service: service,
        type: "config",
        storagePath: getStorageLocation(),
      });
    } else {
      let dbBuffer = await DatabaseService.getDbBuffer(type);
      let dbBlob = new Blob([dbBuffer], { type: CommonTool.getMimeType("db") });
      let syncUtil = await SyncService.getSyncUtil();
      await syncUtil.uploadFile(type + ".db", "config", dbBlob);
    }
  }

  static async dumpConfig(type: string) {
    let config = {};
    if (type === "sync") {
      config = ConfigService.getAllSyncRecord();
    } else {
      let configList = CommonTool.configList;
      for (let i = 0; i < configList.length; i++) {
        let item = configList[i];
        if (localStorage.getItem(item)) {
          config[item] = localStorage.getItem(item);
        }
      }
    }
    return config;
  }
  static clearConfig(type: string) {
    if (type === "sync") {
      localStorage.removeItem("syncRecord");
    } else {
      let configList = CommonTool.configList;
      for (let i = 0; i < configList.length; i++) {
        let item = configList[i];
        localStorage.removeItem(item);
      }
    }
  }
  static async loadConfig(type: string, configStr: string) {
    let tempConfig = JSON.parse(configStr);
    if (type === "sync") {
      ConfigService.setAllSyncRecord(tempConfig);
    } else {
      for (let key in tempConfig) {
        localStorage.setItem(key, tempConfig[key]);
      }
    }
  }
}
export default ConfigUtil;
