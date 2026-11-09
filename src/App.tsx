import { useCallback, useMemo, useRef, useState } from 'react'
import { ShaderEffect, ShaderFill } from './lib/custom-effect-runtime'
import {
  manifest as waveManifest,
  render as renderWave,
  setup as setupWave,
} from './lib/custom-effects/CodeComponentId_ab661867302271a41f52712edc50561e87761f33_4169'
import {
  manifest as rippleManifest,
  render as renderRipple,
  setup as setupRipple,
} from './lib/custom-effects/CodeComponentId_03def13b700392f32045ab4710e7514364081e3b_493'

const assetPathPrefix = `${import.meta.env.BASE_URL}assets`
const assets = {
  canvas: `${assetPathPrefix}/b7add.png`,
  cursor: `${assetPathPrefix}/b7317.svg`,
  grain: `${assetPathPrefix}/209a8.svg`,
}

const blueWave = {
  setup: setupWave,
  render: renderWave,
  manifest: waveManifest,
  params: {
    medColor: { r: 0.357, g: 0.608, b: 0.835, a: 1 },
    angle: 180,
    speed: 0.2,
    lightColor: { r: 0.659, g: 0.816, b: 0.941, a: 1 },
    waveScale: 1.5,
    bgColor: { r: 0.918, g: 0.949, b: 0.984, a: 1 },
    direction: 2,
    darkColor: { r: 0.106, g: 0.294, b: 0.478, a: 1 },
    waviness: 1,
  },
}

const pinkWave = {
  setup: setupWave,
  render: renderWave,
  manifest: waveManifest,
  params: {
    medColor: { r: 0.78, g: 0.43, b: 0.52, a: 1 },
    angle: 180,
    speed: 0.2,
    lightColor: { r: 0.89, g: 0.733, b: 0.741, a: 1 },
    waveScale: 1.5,
    bgColor: { r: 0.969, g: 0.937, b: 0.855, a: 1 },
    direction: 2,
    darkColor: { r: 0.56, g: 0.25, b: 0.36, a: 1 },
    waviness: 1,
  },
}

function ReactiveText({
  children,
  className = '',
  as: Tag = 'p',
}: {
  children: string
  className?: string
  as?: 'h1' | 'h2' | 'p' | 'span'
}) {
  return (
    <Tag className={`reactive-text ${className}`}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {children.split(' ').map((word, wordIndex, words) => (
          <span className="repel-word" key={`${word}-${wordIndex}`}>
            {Array.from(word).map((character, characterIndex) => (
              <span className="repel-letter" key={`${character}-${characterIndex}`}>
                {character}
              </span>
            ))}
            {wordIndex < words.length - 1 && <span className="word-space">&nbsp;</span>}
          </span>
        ))}
      </span>
    </Tag>
  )
}

export default function App() {
  const stageRef = useRef<HTMLElement>(null)
  const waterRef = useRef<HTMLDivElement>(null)
  const rippleFrame = useRef<number | null>(null)
  const pendingRipple = useRef({ x: 25, y: 25 })
  const [ripplePoints, setRipplePoints] = useState([
    { x: 25, y: 25 },
    { x: 50, y: 50 },
    { x: 75, y: 75 },
  ])

  const reactiveRipple = useMemo(
    () => ({
      setup: setupRipple,
      render: renderRipple,
      manifest: rippleManifest,
      params: {
        frequency: 8,
        ripple1: { ...ripplePoints[0], radius: 30 },
        ripple2: { ...ripplePoints[1], radius: 30 },
        amplitude: 12,
        decay: 1.5,
        ripple3: { ...ripplePoints[2], radius: 30 },
      },
    }),
    [ripplePoints],
  )

  const moveLetters = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return

    const radius = 105
    stageRef.current?.querySelectorAll<HTMLElement>('.repel-letter').forEach((letter) => {
      const box = letter.getBoundingClientRect()
      const dx = box.left + box.width / 2 - event.clientX
      const dy = box.top + box.height / 2 - event.clientY
      const distance = Math.hypot(dx, dy)

      if (distance < radius) {
        const force = (1 - distance / radius) * 19
        const angle = Math.atan2(dy, dx)
        letter.style.setProperty('--letter-x', `${Math.cos(angle) * force}px`)
        letter.style.setProperty('--letter-y', `${Math.sin(angle) * force}px`)
        letter.style.setProperty('--letter-r', `${Math.cos(angle) * force * 0.45}deg`)
      } else {
        letter.style.removeProperty('--letter-x')
        letter.style.removeProperty('--letter-y')
        letter.style.removeProperty('--letter-r')
      }
    })
  }, [])

  const moveWater = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return

    const water = waterRef.current
    if (!water) return

    const box = water.getBoundingClientRect()
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      return

    pendingRipple.current = {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    }

    if (rippleFrame.current !== null) return
    rippleFrame.current = requestAnimationFrame(() => {
      setRipplePoints(([current, previous]) => [pendingRipple.current, current, previous])
      rippleFrame.current = null
    })
  }, [])

  const moveInteraction = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      moveLetters(event)
      moveWater(event)
    },
    [moveLetters, moveWater],
  )

  const resetLetters = useCallback(() => {
    stageRef.current?.querySelectorAll<HTMLElement>('.repel-letter').forEach((letter) => {
      letter.style.removeProperty('--letter-x')
      letter.style.removeProperty('--letter-y')
      letter.style.removeProperty('--letter-r')
    })
  }, [])

  return (
    <main>
      <section
        className="hero"
        onPointerMove={moveInteraction}
        onPointerLeave={resetLetters}
        ref={stageRef}
      >
        <div className="ambient-wave" aria-hidden="true">
          <ShaderFill className="shader-fill" shader={blueWave} />
        </div>

        <div className="right-art" aria-hidden="true" ref={waterRef}>
          <ShaderEffect className="ripple-effect" shaders={[reactiveRipple]}>
            <div className="ripple-inner">
              <ShaderFill className="shader-fill" shader={pinkWave} />
            </div>
          </ShaderEffect>
        </div>

        <img className="grain" src={assets.grain} alt="" width="1512" height="982" />
        <img className="canvas-mark" src={assets.canvas} alt="" width="300" height="150" />
        <img className="cursor-art" src={assets.cursor} alt="" width="87" height="61" />

        <div className="intro">
          <ReactiveText className="eyebrow">Software engineer</ReactiveText>
          <ReactiveText as="h1" className="name">
            Kayura Narayanan
          </ReactiveText>
          <div className="pink-stroke" aria-hidden="true" />
          <ReactiveText className="description">
            howdy all! i’m a ml + full stack dev. check out some of my work here!
          </ReactiveText>
        </div>

      </section>

      <section className="portfolio-section" id="portfolio">
        <div className="portfolio-heading">
          <p>selected work / 2025</p>
          <h2>Projects built with curiosity.</h2>
        </div>
        <div className="project-grid">
          {[
            ['01', 'Machine learning systems', 'Models, tooling + thoughtful interfaces'],
            ['02', 'Full-stack experiments', 'Code that feels tactile and human'],
            ['03', 'Creative development', 'Playful interactions for the web'],
          ].map(([number, title, detail]) => (
            <article className="project-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
              <span className="card-arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
