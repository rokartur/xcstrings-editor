import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, FolderUp, Globe, Languages, PackageCheck, Pencil } from 'lucide-react'

import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'
import { cn } from '../lib/utils.ts'

/* ─── Step definitions ─── */

interface StepDef {
  id: number
  path: string
  label: string
  icon: React.ReactNode
  description: string
}

const STEPS: StepDef[] = [
  { id: 1, path: '/', label: 'Import', icon: <FolderUp className="size-4" strokeWidth={1.8} />, description: 'Load your .xcstrings catalog' },
  { id: 2, path: '/configure', label: 'Configure', icon: <Languages className="size-4" strokeWidth={1.8} />, description: 'Add languages & project file' },
  { id: 3, path: '/translate', label: 'Translate', icon: <Pencil className="size-4" strokeWidth={1.8} />, description: 'Edit translations by locale' },
  { id: 4, path: '/export', label: 'Export', icon: <PackageCheck className="size-4" strokeWidth={1.8} />, description: 'Download file or publish to GitHub' },
]

/* ─── Stepper indicator ─── */

function StepIndicator({
  step,
  currentStep,
  isComplete,
  isReachable,
  onClick,
}: {
  step: StepDef
  currentStep: number
  isComplete: boolean
  isReachable: boolean
  onClick: () => void
}) {
  const isActive = step.id === currentStep

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isReachable}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 transition-all',
        isReachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
      )}
    >
      <div
        className={cn(
          'relative flex size-10 items-center justify-center rounded-xl border-2 transition-all duration-200',
          isActive
            ? 'border-primary bg-primary text-primary-foreground shadow-md scale-110'
            : isComplete
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-border bg-card text-muted-foreground group-hover:border-primary/40',
        )}
      >
        {isComplete && !isActive ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          step.icon
        )}
      </div>
      <span
        className={cn(
          'text-[11px] font-medium tracking-wide transition-colors',
          isActive
            ? 'text-foreground'
            : isComplete
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground',
        )}
      >
        {step.label}
      </span>
    </button>
  )
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="mt-[-18px] flex flex-1 items-center px-1 sm:px-2">
      <div
        className={cn(
          'h-0.5 w-full rounded-full transition-colors duration-300',
          isComplete ? 'bg-emerald-500/60' : 'bg-border',
        )}
      />
    </div>
  )
}

/* ─── Layout ─── */

export function StepperLayout() {
  const { catalog } = useCatalog()
  const location = useLocation()
  const navigate = useNavigate()

  const activeStepId = useMemo(() => {
    const path = location.pathname
    const match = STEPS.find((s) => s.path === path)
    return match?.id ?? 1
  }, [location.pathname])

  const activeStep = STEPS[activeStepId - 1]!

  /* completion logic */
  const step1Complete = !!catalog
  const step2Complete = step1Complete && (catalog?.languages.length ?? 0) > 0
  const step3Complete = step2Complete && (catalog?.dirtyKeys.size ?? 0) > 0

  const isStepReachable = (id: number) => {
    if (id === 1) return true
    if (id === 2) return step1Complete
    if (id === 3) return step2Complete
    if (id === 4) return step1Complete
    return false
  }

  const isStepComplete = (id: number) => {
    if (id === 1) return step1Complete
    if (id === 2) return step2Complete
    if (id === 3) return step3Complete
    return false
  }

  const dirtyKeyCount = catalog?.dirtyKeys.size ?? 0

  const goToStep = (id: number) => {
    const step = STEPS.find((s) => s.id === id)
    if (step && isStepReachable(id)) {
      navigate(step.path)
    }
  }

  const goNext = () => goToStep(Math.min(activeStepId + 1, 4))
  const goPrev = () => goToStep(Math.max(activeStepId - 1, 1))

  return (
    <div className="grid gap-6">
      {/* ─── Stepper bar ─── */}
      <div className="flex items-start justify-center gap-0 rounded-2xl border border-border/60 bg-card/80 px-4 py-5 shadow-sm sm:px-6">
        {STEPS.map((step, index) => (
          <div key={step.id} className="contents">
            <StepIndicator
              step={step}
              currentStep={activeStepId}
              isComplete={isStepComplete(step.id)}
              isReachable={isStepReachable(step.id)}
              onClick={() => goToStep(step.id)}
            />
            {index < STEPS.length - 1 && (
              <StepConnector isComplete={isStepComplete(step.id)} />
            )}
          </div>
        ))}
      </div>

      {/* ─── Step header ─── */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{activeStep.label}</h2>
          <p className="text-sm text-muted-foreground">{activeStep.description}</p>
        </div>
        {catalog && (
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="gap-1 font-normal">
              <Globe className="size-3" />
              {catalog.languages.length} locales
            </Badge>
            <Badge variant="outline" className="font-normal">
              {catalog.entries.length} keys
            </Badge>
            {dirtyKeyCount > 0 && (
              <Badge className="font-normal">{dirtyKeyCount} changed</Badge>
            )}
          </div>
        )}
      </div>

      {/* ─── Loading indicator ─── */}
      {!catalog && activeStepId > 1 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          No catalog loaded. Go back to the Import step to load a file.
        </div>
      )}

      {/* ─── Step content ─── */}
      <Outlet />

      {/* ─── Navigation ─── */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={activeStepId === 1}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1.5">
          {STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(step.id)}
              disabled={!isStepReachable(step.id)}
              className={cn(
                'size-2 rounded-full transition-all',
                activeStepId === step.id
                  ? 'w-6 bg-primary'
                  : isStepComplete(step.id)
                    ? 'bg-emerald-500/60'
                    : isStepReachable(step.id)
                      ? 'bg-border hover:bg-primary/40'
                      : 'bg-border/40',
              )}
              aria-label={`Go to step ${step.id}: ${step.label}`}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={activeStepId === 4 || !isStepReachable(activeStepId + 1)}
          className="gap-1.5"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
