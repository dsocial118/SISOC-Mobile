import imageCompression from 'browser-image-compression'

export interface SelectedPhoto {
  file: File
  data_url: string
}

function extensionForMimeType(mimeType: string | undefined): string | null {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return null
  }
}

function buildNormalizedFileName(fileName: string, mimeType: string | undefined): string {
  const extension = extensionForMimeType(mimeType)
  if (!extension) {
    return fileName
  }

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'foto'
  return `${baseName}.${extension}`
}

function normalizeCompressedFile(originalFile: File, compressedFile: File): File {
  const normalizedType = compressedFile.type || originalFile.type
  const normalizedName = buildNormalizedFileName(originalFile.name, normalizedType)
  return new File([compressedFile], normalizedName, {
    type: normalizedType || 'application/octet-stream',
    lastModified: compressedFile.lastModified || Date.now(),
  })
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function pickImage(options?: { capture?: 'environment' | 'user' }): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (options?.capture) {
      input.capture = options.capture
    }

    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }
    input.click()
  })
}

async function processImage(file: File): Promise<SelectedPhoto> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1600,
    fileType: file.type || undefined,
    useWebWorker: true,
  })
  const normalizedFile = normalizeCompressedFile(file, compressed)

  return {
    file: normalizedFile,
    data_url: await readAsDataURL(normalizedFile),
  }
}

export async function takePhoto(): Promise<SelectedPhoto | null> {
  const file = await pickImage({ capture: 'environment' })
  if (!file) {
    return null
  }
  return processImage(file)
}

export async function pickFromGallery(): Promise<SelectedPhoto | null> {
  const file = await pickImage()
  if (!file) {
    return null
  }
  return processImage(file)
}
