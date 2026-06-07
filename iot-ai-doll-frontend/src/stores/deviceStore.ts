/**
 * 设备状态管理 - Zustand
 */
import { create } from 'zustand';
import type { Device } from '../types';
import { getDevices, bindDevice } from '../api/device';

interface DeviceState {
  /** 设备列表 */
  devices: Device[];
  /** 当前选中的设备 SN */
  activeSn: string | null;
  /** 加载中 */
  loading: boolean;

  /** 加载设备列表 */
  fetchDevices: () => Promise<void>;
  /** 绑定新设备 */
  bind: (sn: string, deviceName: string) => Promise<void>;
  /** 选中设备 */
  setActive: (sn: string) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  activeSn: null,
  loading: false,

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const res = await getDevices();
      const devices = res.data;
      set({ devices, loading: false });
      // 如果没有选中设备且列表非空，自动选中第一个
      if (!get().activeSn && devices.length > 0) {
        set({ activeSn: devices[0].sn });
      }
    } catch {
      set({ loading: false });
    }
  },

  bind: async (sn, deviceName) => {
    const res = await bindDevice({ sn, deviceName });
    set((state) => ({
      devices: [...state.devices, res.data],
      activeSn: state.activeSn ?? sn,
    }));
  },

  setActive: (sn) => set({ activeSn: sn }),
}));
