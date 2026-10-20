import useDocumentTitle from '../hooks/useDocumentTitle'
import DriverManager from '../features/drivers/DriverManager'

export default function PilotsPage() {
  useDocumentTitle('Пилоты')
  return <DriverManager />
}
