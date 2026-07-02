import axiosInstance from './axiosInstance'

export interface UploadResult {
  url: string
  publicId: string
  width: number
  height: number
}

export const uploadApi = {
  image: async (file: File): Promise<UploadResult> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axiosInstance.post<{ success: boolean } & UploadResult>(
      '/upload/image',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return { url: data.url, publicId: data.publicId, width: data.width, height: data.height }
  },
}
