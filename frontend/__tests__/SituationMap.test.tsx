import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MOCK_SATELLITES, MOCK_WILDFIRES } from '@/data/mock'

vi.mock('maplibre-gl', () => {
  class MockMap {
    container: HTMLElement

    constructor({ container }: { container: HTMLElement }) {
      this.container = container
    }

    addControl() {}
    isStyleLoaded() { return true }
    once() {}
    off() {}
    remove() {}
  }

  class MockMarker {
    element: HTMLElement

    constructor({ element }: { element: HTMLElement }) {
      this.element = element
    }

    setLngLat() { return this }
    setPopup() { return this }
    addTo(map: MockMap) {
      map.container.appendChild(this.element)
      return this
    }
    remove() { this.element.remove() }
  }

  class MockPopup {
    setHTML() { return this }
  }

  class MockControl {}

  return {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    NavigationControl: MockControl,
    AttributionControl: MockControl,
    setWorkerUrl: vi.fn(),
  }
})

import SituationMap from '@/components/map/SituationMap'

describe('SituationMap', () => {
  it('selects a wildfire zone from its map marker', () => {
    const onSelectWildfire = vi.fn()
    render(
      <SituationMap
        wildfires={MOCK_WILDFIRES}
        satellites={MOCK_SATELLITES}
        recommendedWildfireId={1}
        selectedWildfireId={1}
        unobservableWildfireIds={[4]}
        onSelectWildfire={onSelectWildfire}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /select zone c/i }))

    expect(onSelectWildfire).toHaveBeenCalledWith(3)
  })
})
