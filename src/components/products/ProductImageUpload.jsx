import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

function resizeToWebp(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, 400 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('Image compression failed'))
      }, 'image/webp', 0.82)
    }
    image.onerror = () => reject(new Error('Image could not be read'))
    image.src = url
  })
}

export default function ProductImageUpload({ companyId, productId, value, onChange }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError(t('products.imageError'))
      return
    }
    setUploading(true)
    setError('')
    try {
      const blob = await resizeToWebp(file)
      const path = `${companyId}/${productId}.webp`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, blob, { upsert: true, contentType: 'image/webp' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      const { error: updateError } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId)
      if (updateError) throw updateError
      onChange?.(data.publicUrl)
    } catch (uploadError) {
      setError(uploadError.message || t('common.genericError'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <div className="flex items-center gap-3">
    {value ? <img src={value} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl bg-orange-pale flex items-center justify-center">🍞</div>}
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="sr-only" aria-label={t('products.uploadImage')} />
      <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary h-10 px-3 text-sm">{uploading ? t('common.saving') : t('products.uploadImage')}</button>
      {error && <p className="text-xs text-bad mt-1">{error}</p>}
    </div>
  </div>
}
