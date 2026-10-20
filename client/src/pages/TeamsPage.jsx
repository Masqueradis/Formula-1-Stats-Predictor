import useDocumentTitle from '../hooks/useDocumentTitle'
import TeamManager from '../features/teams/TeamManager'

export default function TeamsPage() {
  useDocumentTitle('Команды')
  return <TeamManager />
}