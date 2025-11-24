import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import type { DailyNote } from '@/types/database'

export function useDailyNotes() {
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [loading, setLoading] = useState(true)
  
  const fetchNotes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_notes')
      .select('*')
      .order('date', { ascending: false })
    
    if (!error && data) {
      setNotes(data)
    } else if (error) {
      console.error('Error fetching daily notes:', error)
    }
    setLoading(false)
  }
  
  const getNoteByDate = (date: Date): DailyNote | null => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return notes.find(n => n.date === dateStr) || null
  }
  
  const hasNoteOnDate = (date: Date): boolean => {
    return getNoteByDate(date) !== null
  }
  
  const createNote = async (note: Omit<DailyNote, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('daily_notes')
      .insert(note)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating daily note:', JSON.stringify(error, null, 2))
      console.error('Note data:', note)
      throw error
    }
    
    if (data) {
      setNotes([data, ...notes])
      return data
    }
  }
  
  const updateNote = async (id: string, updates: Partial<DailyNote>) => {
    const { data, error } = await supabase
      .from('daily_notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating daily note:', JSON.stringify(error, null, 2))
      console.error('Update data:', updates)
      throw error
    }
    
    if (data) {
      setNotes(notes.map(n => n.id === id ? data : n))
      return data
    }
  }
  
  const deleteNote = async (id: string) => {
    const { error } = await supabase
      .from('daily_notes')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting daily note:', JSON.stringify(error, null, 2))
      throw error
    }
    
    setNotes(notes.filter(n => n.id !== id))
  }
  
  const getNotesByMonth = (year: number, month: number): DailyNote[] => {
    return notes.filter(n => {
      const noteDate = new Date(n.date)
      return noteDate.getFullYear() === year && noteDate.getMonth() === month
    })
  }
  
  const getNotesByCategory = (category: string): DailyNote[] => {
    return notes.filter(n => n.category === category)
  }
  
  useEffect(() => {
    fetchNotes()
  }, [])
  
  return {
    notes,
    loading,
    getNoteByDate,
    hasNoteOnDate,
    createNote,
    updateNote,
    deleteNote,
    getNotesByMonth,
    getNotesByCategory,
    refetch: fetchNotes
  }
}

