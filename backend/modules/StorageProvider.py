from abc import ABC, abstractmethod
import asyncio
from io import BufferedReader, BytesIO
from pathlib import Path
from typing import AsyncIterator, BinaryIO
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.storage.fileshare.aio import ShareDirectoryClient,ShareFileClient
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
import logging

logger = logging.getLogger(__name__)
class StorageProvider(ABC):
    def __init__(self, base_path: str):
        self.base_path = base_path

    @abstractmethod
    def upload_file(self, file: bytes, destination_path: str) -> None:
        pass

    @abstractmethod
    def download_file(self, source_path: str) -> bytes:
        pass
    
    @abstractmethod
    async def upload_stream(self, stream: AsyncIterator[bytes], destination_path: str) -> None:
        pass

    @abstractmethod
    async def write_stream_range(self, stream: AsyncIterator[bytes], destination_path: str, offset: int, size: int) -> None:
        pass

    @abstractmethod
    async def prepare_file(self, file_path: str, size: int) -> None:
        pass

    @abstractmethod
    def get_file_stream(self, file_path: str) -> BinaryIO:
        pass

    @abstractmethod
    def delete_file(self, file_path: str) -> None:
        pass

    @abstractmethod
    def delete_directory(self, directory_path: str) -> None:
        pass

    @abstractmethod
    async def exists(self, file_path: str) -> bool:
        pass

    @abstractmethod
    def get_file_url(self, file_path: str) -> str:
        pass

    @abstractmethod
    def get_file(self, file_path: str) -> BinaryIO:
        pass

    @abstractmethod
    async def ls(self, directory_path: str) -> list[str]:
        pass

    def _resolve_path(self, relative_path: str) -> Path: # prevent traversal outside the abse path
        base = Path(self.base_path).resolve()
        full_path = (base / relative_path).resolve()

        if not full_path.is_relative_to(base):
            raise ValueError("Attempted to access a path outside of the base path.")

        return full_path


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_path: str):
        super().__init__(base_path)

    def upload_file(self, file: bytes, destination_path: str) -> None:
        destination = self._resolve_path(destination_path)

        destination.parent.mkdir(parents=True, exist_ok=True)

        with open(destination, "wb") as f:
            f.write(file)
        logger.debug(f"Uploaded file to {destination}")
    
    def get_file_stream(self, file_path: str) -> BinaryIO:
        try:
            return open(self._resolve_path(file_path), "rb")
        except FileNotFoundError:
            logger.error(f"File '{file_path}' does not exist.")
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None
    
    def delete_directory(self, directory_path: str) -> None:
        directory = self._resolve_path(directory_path)

        if not directory.exists() or not directory.is_dir():
            raise FileNotFoundError(f"Directory '{directory_path}' does not exist.") from None

        for item in directory.rglob("*"):
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                item.rmdir()

        directory.rmdir()
        logger.debug(f"Deleted directory {directory}")

    def download_file(self, source_path: str) -> bytes:
        source = self._resolve_path(source_path)

        try:
            with open(source, "rb") as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"File '{source_path}' does not exist.") from None
        logger.debug(f"Downloaded file from {source}")

    def delete_file(self, file_path: str) -> None:
        path = self._resolve_path(file_path)

        try:
            path.unlink()
        except FileNotFoundError:
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None
        logger.debug(f"Deleted file {path}")

    async def exists(self, file_path: str) -> bool: # azure is async but this is sync 
        logger.debug(f"Checking existence of file {file_path}")
        return self._resolve_path(file_path).exists()
        
            
    def get_file_url(self, file_path: str) -> str:
        return str(self._resolve_path(file_path))
    
    async def prepare_file(self, file_path: str, size: int) -> None: # async because azure storage provider is async, but local storage is sync
        path = self._resolve_path(file_path)

        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "wb") as f:
            f.truncate(size)

    async def write_stream_range(self, stream: AsyncIterator[bytes], destination_path: str, offset: int, size: int) -> None:
        logger.info(f"Writing stream range to {destination_path} at offset {offset} with size {size}")
        destination = self._resolve_path(destination_path)

        destination.parent.mkdir(parents=True, exist_ok=True)

        if not destination.exists():
            with open(destination, "wb") as f:
                logger.info(f"Created new file {destination} for writing stream range")
                f.truncate(offset + size)

        with open(destination, "r+b") as f:
            f.seek(offset)
            bytes_written = 0

            async for chunk in stream:
                if bytes_written + len(chunk) > size:
                    raise ValueError("Stream exceeds the specified size.")

                f.write(chunk)
                bytes_written += len(chunk)

            if bytes_written != size:
                raise ValueError("Stream size does not match the specified size.")
            logger.debug(f"Finished writing stream range to {destination_path}")
            
    async def upload_stream(self, stream: AsyncIterator[bytes], destination_path: str) -> None:
        destination = self._resolve_path(destination_path)

        destination.parent.mkdir(parents=True, exist_ok=True)

        with open(destination, "wb") as f:
            async for chunk in stream:
                f.write(chunk)
 
    def get_file(self, file_path: str) -> BinaryIO:
        try:
            return open(self._resolve_path(file_path), "rb")
        except FileNotFoundError:
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None

    async def ls(self, directory_path: str) -> list[str]:
        directory = self._resolve_path(directory_path)

        if not directory.exists() or not directory.is_dir():
            return []

        return [str(path.relative_to(self.base_path)) for path in directory.rglob("*") if path.is_file()]

class AzureFileStorageProvider(StorageProvider):


    def __init__(self, connection_string: str, share_name: str, base_path: str = "",):
        super().__init__(base_path)

        self.connection_string = connection_string
        self.share_name = share_name

    def _get_client(self, path: str) -> ShareFileClient:
        remote_path = str(Path(self.base_path) / path).replace("\\", "/")
        logger.debug(f"Getting Azure file client for path: {remote_path}")

        return ShareFileClient.from_connection_string(
            conn_str=self.connection_string,
            share_name=self.share_name,
            file_path=remote_path,
        )

    async def _ensure_directory_exists(self, directory: str) -> None:
        if directory in ("", "."):
            return

        current = ""

        for part in directory.split("/"):
            current = f"{current}/{part}" if current else part

            directory_client = ShareDirectoryClient.from_connection_string(
                conn_str=self.connection_string,
                share_name=self.share_name,
                directory_path=current,
            )

            try:
                await directory_client.create_directory()
            except ResourceExistsError:
                pass

    async def upload_file(self, file: bytes, destination_path: str) -> None:
        directory = str(Path(self.base_path) / Path(destination_path).parent).replace("\\", "/")

        await self._ensure_directory_exists(directory)

        client = self._get_client(destination_path)

        await client.upload_file(file)

    async def download_file(self, source_path: str) -> bytes:
        client = self._get_client(source_path)

        try:
            return await client.download_file().readall()
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File '{source_path}' does not exist.") from None
        
    async def get_file_stream(self, file_path: str) -> BinaryIO:
        client = self._get_client(file_path)

        try:
            return await client.download_file()
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None
        
    async def prepare_file(self, file_path: str, size: int) -> None:
        logger.info(f"Preparing file {file_path} with size {size}")
        directory = str(Path(self.base_path) / Path(file_path).parent).replace("\\", "/")

        await self._ensure_directory_exists(directory)

        client = self._get_client(file_path)

        try:
            await client.create_file(size)
        except ResourceExistsError:
            raise FileExistsError(f"File '{file_path}' already exists.") from None
        
    async def write_stream_range(self, stream: AsyncIterator[bytes], destination_path: str, offset: int, size: int) -> None:
        logger.info(f"Writing stream range to {destination_path} at offset {offset} with size {size}")
        client = self._get_client(destination_path)

        buffer = BytesIO()
        bytes_received = 0

        async for chunk in stream:
            if bytes_received + len(chunk) > size:
                raise ValueError("Stream exceeds the specified size.")

            buffer.write(chunk)
            bytes_received += len(chunk)

        if bytes_received != size:
            raise ValueError("Stream size does not match the specified size.")

        buffer.seek(0)

        await client.upload_range(
            data=buffer,
            offset=offset,
            length=size,
        )
    
    async def upload_stream(self, stream: AsyncIterator[bytes], destination_path: str) -> None:
        directory = str(Path(self.base_path) / Path(destination_path).parent).replace("\\", "/")

        await self._ensure_directory_exists(directory)

        client = self._get_client(destination_path)

        file_size = 0
        chunks: list[tuple[int, bytes]] = []

        async for chunk in stream:
            chunks.append((file_size, chunk))
            file_size += len(chunk)

        await client.create_file(file_size)

        async for offset, chunk in chunks:
            await client.upload_range(
                data=chunk,
                offset=offset,
                length=len(chunk),
            )


    async def delete_file(self, file_path: str) -> None:
        client = self._get_client(file_path)

        try:
            await client.delete_file()
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None

    async def exists(self, file_path: str) -> bool:
        client = self._get_client(file_path)
        try:
            await client.get_file_properties()
            return True
        except ResourceNotFoundError:
            return False
        finally:
            await client.close()

    def get_file_url(self, file_path: str) -> str:
        return self._get_client(file_path).url

    async def get_file(self, file_path: str) -> BinaryIO:
        client = self._get_client(file_path)

        try:
            return BytesIO(await client.download_file().readall())
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File '{file_path}' does not exist.") from None
    
    async def delete_directory(self, directory_path: str) -> None:
        directory = str(Path(self.base_path) / directory_path).replace("\\", "/")

        directory_client = ShareDirectoryClient.from_connection_string(
            conn_str=self.connection_string,
            share_name=self.share_name,
            directory_path=directory,
        )

        try:
            await directory_client.delete_directory()
        except ResourceNotFoundError:
            raise FileNotFoundError(f"Directory '{directory_path}' does not exist.") from None

    async def ls(self, directory_path: str) -> list[str]:
        directory = str(Path(self.base_path) / directory_path).replace("\\", "/")

        directory_client = ShareDirectoryClient.from_connection_string(
            conn_str=self.connection_string,
            share_name=self.share_name,
            directory_path=directory,
        )

        files: list[str] = []

        async def recurse(client: ShareDirectoryClient,relative_path: str) -> None:
            for item in await client.list_directories_and_files():
                path = (f"{relative_path}/{item['name']}" if relative_path else item["name"])

                if item["is_directory"]:
                    recurse(client.get_subdirectory_client(item["name"]), path)
                else:
                    files.append(path)

        try:
            recurse(directory_client, "")
        except ResourceNotFoundError:
            return []

        return files