import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

type UploadState = {
    uploadedCount: number;
    uploadedBytes: number;
    uuid: string;
    setUploadStats: (
        count: number,
        bytes: number
    ) => void;
};

const CustomerUploadContext = createContext<UploadState | null>(null);

export function CustomerUploadProvider({
    uuid,
    children,
}: {
    uuid: string;
    children: ReactNode;
}) {
    const [uploadedCount, setUploadedCount] = useState(0);
    const [uploadedBytes, setUploadedBytes] = useState(0);

    return (
        <CustomerUploadContext.Provider
            value={{
                uploadedCount,
                uploadedBytes,
                uuid,
                setUploadStats(count, bytes) {
                    setUploadedCount(count);
                    setUploadedBytes(bytes);
                },
            }}
        >
            {children}
        </CustomerUploadContext.Provider>
    );
}

export function useCustomerUpload() {
    const context = useContext(CustomerUploadContext);

    if (!context) {
        throw new Error(
            "useCustomerUpload must be used inside CustomerUploadProvider"
        );
    }

    return context;
}