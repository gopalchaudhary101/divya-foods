import axiosInstance from './axiosInstance'

export interface ContactFormRequest {
  name: string
  email: string
  phone?: string
  message: string
}

export const contactApi = {
  submit: async (payload: ContactFormRequest): Promise<{ success: boolean; message: string }> => {
    const { data } = await axiosInstance.post<{ success: boolean; message: string }>('/contact', payload)
    return data
  },
}
