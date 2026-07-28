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


type CustomerUploadContextValue = {
  uploadedCount: number;
  uploadedBytes: number;
  uuid: string;


  setUploadStats: (count: number, bytes: number) => void;
  
  deletionRequested: boolean;
  markDeletionRequested: () => void;
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

  


  const [deletionRequested, setDeletionRequested] = useState(false);

  const setUploadStats = useCallback(
    (count: number, bytes: number): void => {
      setUploadedCount(count);
      setUploadedBytes(bytes);
    },
    [],
  );

  
  const markDeletionRequested = useCallback(() => {
    setDeletionRequested(true);

    void saveUploadSettings({
      uuid,
      deletionRequested: true,
    });
  }, [uuid]);

  const contextValue = useMemo(
    () => ({
      uploadedBytes,
      uploadedCount,
      uuid,

      setUploadStats,

      deletionRequested,
      markDeletionRequested,
    }),
    [
      uploadedBytes,
      uploadedCount,
      uuid,
      setUploadStats,
      deletionRequested,
      markDeletionRequested,
    ],
  );
  useEffect(() => {
    async function restoreSettings() {
      const settings = await getUploadSettings(uuid);

      if (settings) {
        

        if (settings.deletionRequested) {
          setDeletionRequested(true);
        }
      }

   
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