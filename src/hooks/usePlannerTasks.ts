import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PlannerTask } from '@/types'
import { isDemoMode, plannerTasksForWorkspace } from '@/lib/demo'
import type { Database } from '@/types/database'

type PlannerTaskInsert = Database['public']['Tables']['planner_tasks']['Insert']
type PlannerTaskUpdate = Database['public']['Tables']['planner_tasks']['Update']

function sortByScheduledAt(items: PlannerTask[]) {
  return [...items].sort(
    (left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime()
  )
}

export function usePlannerTasks(workspaceId?: string, pageId?: string | null) {
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) {
      setTasks(plannerTasksForWorkspace(workspaceId))
      setLoading(false)
      return
    }

    if (!workspaceId) {
      setTasks([])
      setLoading(false)
      return
    }

    let active = true
    setTasks([])
    setLoading(true)

    const fetchTasks = async () => {
      let query = supabase
        .from('planner_tasks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('scheduled_at', { ascending: true })

      if (pageId) {
        query = query.eq('facebook_page_id', pageId)
      }

      const { data, error } = await query

      if (!active) return

      if (error) {
        setTasks([])
      } else {
        setTasks(sortByScheduledAt((data as PlannerTask[]) || []))
      }
      setLoading(false)
    }

    void fetchTasks()

    const channel = supabase
      .channel(`planner_tasks_${workspaceId}${pageId ? `_${pageId}` : ''}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planner_tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as PlannerTask
            if (!pageId || newTask.facebook_page_id === pageId) {
              setTasks((prev) => sortByScheduledAt([...prev, newTask]))
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PlannerTask
            if (pageId && updated.facebook_page_id !== pageId) {
              setTasks((prev) => prev.filter((task) => task.id !== updated.id))
            } else {
              setTasks((prev) =>
                sortByScheduledAt(prev.map((task) => (task.id === updated.id ? updated : task)))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((task) => task.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, pageId])

  const createTask = async (task: PlannerTaskInsert) => {
    if (isDemoMode) {
      const newTask = {
        id: `task-${Date.now()}`,
        user_id: 'demo-user-id',
        workspace_id: task.workspace_id || workspaceId || 'demo-ws-1',
        title: task.title || 'Untitled',
        description: task.description || '',
        scheduled_at: task.scheduled_at || new Date().toISOString(),
        duration_minutes: task.duration_minutes || 60,
        status: (task.status || 'draft') as PlannerTask['status'],
        kind: (task.kind || 'post') as PlannerTask['kind'],
        platform: (task.platform || null) as PlannerTask['platform'],
        link_url: task.link_url || null,
        color: task.color || null,
        external_source: task.external_source || null,
        external_id: task.external_id || null,
        external_calendar_id: task.external_calendar_id || null,
        payload: (task.payload || null) as PlannerTask['payload'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlannerTask
      setTasks((prev) => sortByScheduledAt([...prev, newTask]))
      return newTask
    }

    const { data, error } = await supabase.from('planner_tasks').insert(task as never).select().single()
    if (error) throw error
    const createdTask = data as PlannerTask
    setTasks((prev) => sortByScheduledAt([...prev.filter((item) => item.id !== createdTask.id), createdTask]))
    return createdTask
  }

  const updateTask = async (id: string, updates: PlannerTaskUpdate) => {
    if (isDemoMode) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } as PlannerTask : t)))
      return { ...tasks.find((t) => t.id === id), ...updates } as PlannerTask
    }

    const { data, error } = await supabase.from('planner_tasks').update(updates as never).eq('id', id).select().single()
    if (error) throw error
    setTasks((prev) =>
      sortByScheduledAt(prev.map((task) => (task.id === id ? (data as PlannerTask) : task)))
    )
    return data as PlannerTask
  }

  const deleteTask = async (id: string) => {
    if (isDemoMode) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
      return
    }

    const { error } = await supabase.from('planner_tasks').delete().eq('id', id)
    if (error) throw error
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  return { tasks, loading, createTask, updateTask, deleteTask }
}
