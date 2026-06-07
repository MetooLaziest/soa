/**
 * 设备相关 API
 */
import client from './client';
import type { Device, BindDevicePayload } from '../types';

/** 获取当前用户的设备列表 */
export function getDevices() {
  return client.get<Device[]>('/db/devices');
}

/** 绑定新设备 */
export function bindDevice(payload: BindDevicePayload) {
  return client.post<Device>('/db/devices/bind', payload);
}
