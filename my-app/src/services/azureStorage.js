import { BlobServiceClient } from "@azure/storage-blob";

const sasToken = import.meta.env.VITE_AZURE_SAS_TOKEN;
const containerName = import.meta.env.VITE_CONTAINER_NAME;
const storageAccountName = import.meta.env.VITE_STORAGE_ACCOUNT_NAME;

// Build the service URL
const blobService = new BlobServiceClient(
  `https://${storageAccountName}.blob.core.windows.net/?${sasToken}`
);

export const uploadToBlob = async (file) => {
  try {
    const containerClient = blobService.getContainerClient(containerName);
    const blobName = `${Date.now()}-${file.name}`; // Unique name for each upload
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const response = await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    return {
      success: true,
      url: blockBlobClient.url,
      name: blobName,
    };
  } catch (error) {
    console.error("Error uploading to Azure Blob Storage:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
