import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CustomerUploadContextValue = {
  uploadedCount: number;
  uploadedBytes: number;
  uuid: string;
  setUploadStats: (count: number, bytes: number) => void;
};

type CustomerUploadProviderProps = {
  uuid: string;
  children: ReactNode;
};

const CustomerUploadContext = createContext<CustomerUploadContextValue | null>(
  null,
);

export function CustomerUploadProvider({
  uuid,
  children,
}: CustomerUploadProviderProps) {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);

  const setUploadStats = useCallback((count: number, bytes: number): void => {
    setUploadedCount(count);
    setUploadedBytes(bytes);
  }, []);

  const contextValue = useMemo(
    () => ({
      uploadedBytes,
      uploadedCount,
      uuid,
      setUploadStats,
    }),
    [setUploadStats, uploadedBytes, uploadedCount, uuid],
  );

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
