const DEVICE_KEY_STORAGE = 'nontizimi_device_key'

export function getDeviceKey() {
  let key = localStorage.getItem(DEVICE_KEY_STORAGE)
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY_STORAGE, key)
  }
  return key
}

export function getDeviceLabel() {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Android qurilma'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS qurilma'
  if (/Windows/i.test(ua)) return 'Windows kompyuter'
  if (/Mac/i.test(ua)) return 'Mac kompyuter'
  return 'Noma\'lum qurilma'
}
