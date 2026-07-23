import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  getUploadSettings,
  saveUploadSettings,
} from "./indexedDb";
type UploadRegion = "US" | "EU";

type CustomerUploadContextValue = {
  uploadedCount: number;
  uploadedBytes: number;
  uuid: string;

  region: "US" | "EU";
  uploadStarted: boolean;

  setRegion: (region: "US" | "EU") => void;
  markUploadStarted: () => void;

  setUploadStats: (count: number, bytes: number) => void;
  settingsLoaded: boolean;
};

type CustomerUploadProviderProps = {
  uuid: string;
  children: ReactNode;
};

const CustomerUploadContext =
  createContext<CustomerUploadContextValue | null>(null);

export function CustomerUploadProvider({
  uuid,
  children,
}: CustomerUploadProviderProps) {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);

  const [region, setRegionState] = useState<UploadRegion>("US");

  const [uploadStarted, setUploadStarted] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const setUploadStats = useCallback(
    (count: number, bytes: number): void => {
      setUploadedCount(count);
      setUploadedBytes(bytes);
    },
    [],
  );
  const setRegion = useCallback(
    (newRegion: UploadRegion): void => {
      setRegionState(newRegion);

      void saveUploadSettings({
        uuid,
        region: newRegion,
        uploadStarted,
      });
    },
    [uuid, uploadStarted],
  );
  const markUploadStarted = useCallback((): void => {
    setUploadStarted(true);

    void saveUploadSettings({
      uuid,
      region,
      uploadStarted: true,
    });
  }, [uuid, region]);
  
  const contextValue = useMemo(
    () => ({
      uploadedBytes,
      uploadedCount,
      uuid,

      region,
      setRegion,

      uploadStarted,
      markUploadStarted,

      setUploadStats,
      settingsLoaded,
    }),
    [
      uploadedBytes,
      uploadedCount,
      uuid,
      region,
      uploadStarted,
      markUploadStarted,
      setUploadStats,
      settingsLoaded,
    ],
  );
  useEffect(() => {
    async function restoreSettings() {
      const settings = await getUploadSettings(uuid);

      if (settings) {
        setRegion(settings.region);

        if (settings.uploadStarted) {
          setUploadStarted(true);
        }
      }

      setSettingsLoaded(true);
    }

    void restoreSettings();
  }, [uuid]);

  return (
    <CustomerUploadContext.Provider value={contextValue}>
      {children}
    </CustomerUploadContext.Provider>
  );
}

export function useCustomerUpload(): CustomerUploadContextValue {
  const context = useContext(CustomerUploadContext);

  if (!context) {
    throw new Error(
      "useCustomerUpload must be used inside CustomerUploadProvider.",
    );
  }

  return context;
}