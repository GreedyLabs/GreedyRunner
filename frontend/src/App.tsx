import { MainLayout } from './presentation/layouts/MainLayout'
import { HomePage } from './presentation/pages/HomePage'
import { UmamiScript } from './presentation/components/shared/UmamiScript'

function App() {
  return (
    <MainLayout>
      <UmamiScript />
      <HomePage />
    </MainLayout>
  )
}

export default App
