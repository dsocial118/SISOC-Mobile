import imageCompression from 'browser-image-compression'

export interface SelectedPhoto {
  file: File
  data_url: string
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
    useWebWorker: true,
  })

  return {
    file: compressed,
    data_url: await readAsDataURL(compressed),
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
