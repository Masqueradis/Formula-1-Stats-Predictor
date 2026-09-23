import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import Button from './ui/Button'

export default function FavoriteButton({ type, entityId }) {
  const { user, refreshMe } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  const favList = type === 'drivers' ? user.favoriteDrivers : user.favoriteTeams
  const idField = type === 'drivers' ? 'driverId' : 'teamId'
  const isFav = Boolean(favList?.some((item) => item.id === entityId))

  const toggle = async () => {
    setLoading(true)
    setError('')
    try {
      if (isFav) {
        await api.delete(`/users/${user.id}/favorite-${type}/${entityId}`)
      } else {
        await api.post(`/users/${user.id}/favorite-${type}`, { [idField]: entityId })
      }
      await refreshMe()
    } catch (err) {
      if (err.response?.status !== 409) {
        setError('Не удалось обновить избранное')
      } else {
        await refreshMe()
      }
    }
    setLoading(false)
  }

  return (
    <div>
      <Button variant={isFav ? 'outline' : 'primary'} onClick={toggle} disabled={loading}>
        {isFav ? '★ Убрать из избранного' : '☆ В избранное'}
      </Button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}