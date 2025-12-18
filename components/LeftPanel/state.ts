import { useReducer } from 'react'
import type { Task } from '@/types/database'
import type { PanelTab } from './types'

// ===== UI State Types =====
export interface UIState {
  // Modal states
  showProjectModal: boolean
  showNotionLinkModal: boolean
  showAllCompletedModal: boolean
  isCompletedExpanded: boolean
  
  // Selection states
  selectedTask: Task | null
  selectedProjectId: string | null
  popoverPosition: { x: number; y: number } | undefined
  
  // Expansion states
  expandedTaskIds: Set<string>
  completingIds: Set<string>
  
  // Tab state
  activeTab: PanelTab
}

// ===== Form State Types =====
export interface FormState {
  newTaskTitle: string
  newLinkTitle: string
  newLinkUrl: string
}

// ===== Action Types =====
type UIAction =
  // Modal actions
  | { type: 'TOGGLE_PROJECT_MODAL'; payload?: boolean }
  | { type: 'TOGGLE_NOTION_LINK_MODAL'; payload?: boolean }
  | { type: 'TOGGLE_ALL_COMPLETED_MODAL'; payload?: boolean }
  | { type: 'TOGGLE_COMPLETED_EXPANDED'; payload?: boolean }
  
  // Selection actions
  | { type: 'SET_SELECTED_TASK'; payload: Task | null }
  | { type: 'SET_SELECTED_PROJECT'; payload: string | null }
  | { type: 'SET_POPOVER_POSITION'; payload: { x: number; y: number } | undefined }
  
  // Expansion actions
  | { type: 'TOGGLE_TASK_EXPAND'; payload: string }
  | { type: 'ADD_COMPLETING_ID'; payload: string }
  | { type: 'REMOVE_COMPLETING_ID'; payload: string }
  
  // Tab action
  | { type: 'SET_ACTIVE_TAB'; payload: PanelTab }
  
  // Reset actions
  | { type: 'RESET_FORM_MODALS' }

type FormAction =
  | { type: 'SET_NEW_TASK_TITLE'; payload: string }
  | { type: 'SET_NEW_LINK_TITLE'; payload: string }
  | { type: 'SET_NEW_LINK_URL'; payload: string }
  | { type: 'RESET_TASK_FORM' }
  | { type: 'RESET_LINK_FORM' }

// ===== Initial States =====
export const initialUIState: UIState = {
  showProjectModal: false,
  showNotionLinkModal: false,
  showAllCompletedModal: false,
  isCompletedExpanded: false,
  selectedTask: null,
  selectedProjectId: null,
  popoverPosition: undefined,
  expandedTaskIds: new Set(),
  completingIds: new Set(),
  activeTab: 'main'
}

export const initialFormState: FormState = {
  newTaskTitle: '',
  newLinkTitle: '',
  newLinkUrl: ''
}

// ===== Reducers =====
export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'TOGGLE_PROJECT_MODAL':
      return { ...state, showProjectModal: action.payload ?? !state.showProjectModal }
    
    case 'TOGGLE_NOTION_LINK_MODAL':
      return { ...state, showNotionLinkModal: action.payload ?? !state.showNotionLinkModal }
    
    case 'TOGGLE_ALL_COMPLETED_MODAL':
      return { ...state, showAllCompletedModal: action.payload ?? !state.showAllCompletedModal }
    
    case 'TOGGLE_COMPLETED_EXPANDED':
      return { ...state, isCompletedExpanded: action.payload ?? !state.isCompletedExpanded }
    
    case 'SET_SELECTED_TASK':
      return { ...state, selectedTask: action.payload }
    
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProjectId: action.payload }
    
    case 'SET_POPOVER_POSITION':
      return { ...state, popoverPosition: action.payload }
    
    case 'TOGGLE_TASK_EXPAND': {
      const newExpandedIds = new Set(state.expandedTaskIds)
      if (newExpandedIds.has(action.payload)) {
        newExpandedIds.delete(action.payload)
      } else {
        newExpandedIds.add(action.payload)
      }
      return { ...state, expandedTaskIds: newExpandedIds }
    }
    
    case 'ADD_COMPLETING_ID': {
      const newCompletingIds = new Set(state.completingIds)
      newCompletingIds.add(action.payload)
      return { ...state, completingIds: newCompletingIds }
    }
    
    case 'REMOVE_COMPLETING_ID': {
      const newCompletingIds = new Set(state.completingIds)
      newCompletingIds.delete(action.payload)
      return { ...state, completingIds: newCompletingIds }
    }
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload }
    
    case 'RESET_FORM_MODALS':
      return {
        ...state,
        showProjectModal: false,
        showNotionLinkModal: false,
        showAllCompletedModal: false
      }
    
    default:
      return state
  }
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_NEW_TASK_TITLE':
      return { ...state, newTaskTitle: action.payload }
    
    case 'SET_NEW_LINK_TITLE':
      return { ...state, newLinkTitle: action.payload }
    
    case 'SET_NEW_LINK_URL':
      return { ...state, newLinkUrl: action.payload }
    
    case 'RESET_TASK_FORM':
      return { ...state, newTaskTitle: '' }
    
    case 'RESET_LINK_FORM':
      return { ...state, newLinkTitle: '', newLinkUrl: '' }
    
    default:
      return state
  }
}

// ===== Custom Hooks =====
export function useUIState() {
  return useReducer(uiReducer, initialUIState)
}

export function useFormState() {
  return useReducer(formReducer, initialFormState)
}
