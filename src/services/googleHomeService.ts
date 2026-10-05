export interface GoogleHomeDevice {
  id: string;
  name: string;
  type?: string;
  status?: string;
  isOn?: boolean;
}

export const googleHomeService = {
  isConfigured: (): boolean => false,
  syncDevices: async (): Promise<GoogleHomeDevice[]> => [],
  getDevices: (): GoogleHomeDevice[] => [],
  sendCommand: async (_deviceId: string, _command: string): Promise<boolean> => true,
  setDeviceState: async (_deviceId: string, _state: { isOn: boolean }): Promise<boolean> => true,
  toggleDevice: async (_deviceId: string): Promise<boolean> => true,
  executeRoutine: async (_routineId: string): Promise<boolean> => true
};

export default googleHomeService;
