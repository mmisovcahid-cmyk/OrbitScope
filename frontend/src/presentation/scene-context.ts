import { createContext, useContext } from 'react';

/** What every scene knows about itself: is it on screen (active) and has it ever been (seen). */
export interface SceneState { active: boolean; seen: boolean; index: number; }
export const SceneContext = createContext<SceneState>({ active: false, seen: false, index: 0 });
export const useScene = (): SceneState => useContext(SceneContext);
