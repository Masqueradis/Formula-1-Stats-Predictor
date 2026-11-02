import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import api from '../api'
import Button from './ui/Button'
import { useToast } from './ui/useToast'

const NOUNS = {
  drivers: { add: 'Пилот добавлен в избранное', remove: 'Пилот убран из избранного' },
  teams: { add: 'Команда добавлена в избранное', remove: 'Команда убрана из избранного' },
}

export default function FavoriteButton({ type, entityId }) {
  const { user, refreshMe } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const favList = type === 'drivers' ? user.favoriteDrivers : user.favoriteTeams
  const idField = type === 'drivers' ? 'driverId' : 'teamId'
  const isFav = Boolean(favList?.some((item) => item.id === entityId))
  const nouns = NOUNS[type] || NOUNS.drivers

  const toggle = async () => {
    setLoading(true)
    try {
      if (isFav) {
        await api.delete(`/users/${user.id}/favorite-${type}/${entityId}`)
        toast.success(nouns.remove)
      } else {
        await api.post(`/users/${user.id}/favorite-${type}`, { [idField]: entityId })
        toast.success(nouns.add)
      }
      await refreshMe()
    } catch (err) {
      if (err.response?.status === 409) {
        await refreshMe()
      } else {
        toast.error(err.response?.data?.error || 'Не удалось обновить избранное')
      }
    }
    setLoading(false)
  }

  return (
    <Button variant={isFav ? 'outline' : 'primary'} onClick={toggle} disabled={loading}>
      {isFav ? '★ Убрать из избранного' : '☆ В избранное'}
    </Button>
  )
}