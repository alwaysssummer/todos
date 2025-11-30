'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { X, BookOpen, Trash2, Plus, Minus, Edit2, Check, ChevronRight, ChevronDown, GripVertical, Save, FileDown, FolderOpen, MessageSquare } from 'lucide-react'
import type { Textbook, TextbookGroup, TextbookSubgroup, TextbookChapter, TextbookTemplate, TemplateChapter } from '@/types/database'
import { useTextbookChapters } from '@/hooks/useTextbookChapters'
import { useTextbookTemplates } from '@/hooks/useTextbookTemplates'

// 세션 스토리지 키
const STORAGE_KEY_COLLAPSED_GROUPS = 'textbook-collapsed-groups'
const STORAGE_KEY_COLLAPSED_SUBGROUPS = 'textbook-collapsed-subgroups'
const STORAGE_KEY_EXPANDED_TEXTBOOKS = 'textbook-expanded-textbooks'

// 세션 스토리지에서 Set 불러오기
const loadFromSession = (key: string): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    const stored = sessionStorage.getItem(key)
    if (!stored) return new Set()
    try {
        return new Set(JSON.parse(stored))
    } catch {
        return new Set()
    }
}

// 세션 스토리지에 Set 저장
const saveToSession = (key: string, set: Set<string>) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(key, JSON.stringify([...set]))
}

interface TextbookManagementModalProps {
    onClose: () => void
    textbooks: Textbook[]
    groups: TextbookGroup[]
    subgroups: TextbookSubgroup[]
    onCreateTextbook: (textbook: Partial<Textbook>) => Promise<Textbook>
    onDeleteTextbook: (id: string) => Promise<void>
    onUpdateTextbookGroup: (id: string, groupId: string | null) => Promise<Textbook>
    onUpdateTextbookSubgroup: (id: string, subgroupId: string | null) => Promise<Textbook>
    onUpdateTextbookChapters: (id: string, totalChapters: number) => Promise<Textbook>
    onUpdateTextbookLocalPath: (id: string, localPath: string | null) => Promise<Textbook>
    onUpdateTextbookMemo: (id: string, memo: string | null) => Promise<Textbook>
    onUpdateTextbookName: (id: string, name: string) => Promise<Textbook>
    onReorderTextbooks: (reorderedTextbooks: Textbook[]) => Promise<void>
    onCreateGroup: (name: string) => Promise<TextbookGroup>
    onUpdateGroup: (id: string, name: string) => Promise<TextbookGroup>
    onDeleteGroup: (id: string) => Promise<void>
    onReorderGroups: (reorderedGroups: TextbookGroup[]) => Promise<void>
    onCreateSubgroup: (groupId: string, name: string) => Promise<TextbookSubgroup>
    onUpdateSubgroup: (id: string, updates: { name?: string; local_path?: string | null; memo?: string | null }) => Promise<TextbookSubgroup>
    onDeleteSubgroup: (id: string) => Promise<void>
    onReorderSubgroups: (reorderedSubgroups: TextbookSubgroup[]) => Promise<void>
}

export default function TextbookManagementModal({
    onClose,
    textbooks,
    groups,
    subgroups,
    onCreateTextbook,
    onDeleteTextbook,
    onUpdateTextbookGroup,
    onUpdateTextbookSubgroup,
    onUpdateTextbookChapters,
    onUpdateTextbookLocalPath,
    onUpdateTextbookMemo,
    onUpdateTextbookName,
    onReorderTextbooks,
    onCreateGroup,
    onUpdateGroup,
    onDeleteGroup,
    onReorderGroups,
    onCreateSubgroup,
    onUpdateSubgroup,
    onDeleteSubgroup,
    onReorderSubgroups,
}: TextbookManagementModalProps) {
    // 템플릿 훅
    const { 
        templates, 
        loading: templatesLoading,
        createTemplateFromTextbook, 
        deleteTemplate,
        getTextbookDataFromTemplate 
    } = useTextbookTemplates()

    // 새 교재 추가 폼 상태
    const [name, setName] = useState('')
    const [totalChapters, setTotalChapters] = useState(10)
    const [chapterUnit, setChapterUnit] = useState<'강' | '과' | 'Unit' | 'Chapter' | '직접입력'>('강')
    const [customUnit, setCustomUnit] = useState('')
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [selectedSubgroupId, setSelectedSubgroupId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    
    // 템플릿 관련 상태
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [templateChapters, setTemplateChapters] = useState<TemplateChapter[]>([])
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
    const [saveTemplateTextbookId, setSaveTemplateTextbookId] = useState<string | null>(null)
    const [templateName, setTemplateName] = useState('')

    // 그룹 관리 상태
    const [activeTab, setActiveTab] = useState<string | null>(null) // null = 전체
    const [isAddingGroup, setIsAddingGroup] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
    const [editingGroupName, setEditingGroupName] = useState('')
    
    // 그룹 탭 변경 시 선택된 그룹 자동 반영 (교재 추가 폼용)
    useEffect(() => {
        if (activeTab) {
            setSelectedGroupId(activeTab)
            setSelectedSubgroupId(null)
        }
    }, [activeTab])

    // 서브그룹 관리 상태
    const [isAddingSubgroup, setIsAddingSubgroup] = useState(false)
    const [newSubgroupName, setNewSubgroupName] = useState('')
    const [editingSubgroupId, setEditingSubgroupId] = useState<string | null>(null)
    const [editingSubgroupName, setEditingSubgroupName] = useState('')
    
    // 교재명 수정
    const [editingTextbookId, setEditingTextbookId] = useState<string | null>(null)
    const [editingTextbookName, setEditingTextbookName] = useState('')
    
    // 폴더 경로 편집
    const [editingPathId, setEditingPathId] = useState<string | null>(null)
    const [pathInput, setPathInput] = useState('')
    
    // 메모 편집 모달
    const [showMemoModal, setShowMemoModal] = useState(false)
    const [memoModalTarget, setMemoModalTarget] = useState<{ id: string; name: string; type: 'subgroup' | 'textbook'; memo: string }>({ id: '', name: '', type: 'subgroup', memo: '' })
    const [memoInput, setMemoInput] = useState('')
    
    // 메모 추적 뷰
    const [showMemoView, setShowMemoView] = useState(false)
    
    // 인라인 교재 추가
    const [inlineAddSubgroupId, setInlineAddSubgroupId] = useState<string | null>(null)
    const [inlineTextbookName, setInlineTextbookName] = useState('')
    const [inlineChapterCount, setInlineChapterCount] = useState(10)
    
    // 폴더 열기 함수 (opendir:// 커스텀 프로토콜 사용)
    const openLocalFolder = (path: string) => {
        // 역슬래시를 슬래시로 변환하고 프로토콜 추가
        const url = 'opendir://' + path.replace(/\\/g, '/')
        window.location.href = url
    }

    // 토글 상태 - 세션 스토리지에서 초기화
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => 
        loadFromSession(STORAGE_KEY_COLLAPSED_GROUPS)
    )
    const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(() => 
        loadFromSession(STORAGE_KEY_COLLAPSED_SUBGROUPS)
    )
    const [expandedTextbooks, setExpandedTextbooks] = useState<Set<string>>(() => 
        loadFromSession(STORAGE_KEY_EXPANDED_TEXTBOOKS)
    )

    // 교재 펼치기/접기
    const toggleTextbook = (textbookId: string) => {
        setExpandedTextbooks(prev => {
            const next = new Set(prev)
            if (next.has(textbookId)) next.delete(textbookId)
            else next.add(textbookId)
            saveToSession(STORAGE_KEY_EXPANDED_TEXTBOOKS, next)
            return next
        })
    }

    // 드래그 상태 - 그룹
    const [draggingGroup, setDraggingGroup] = useState<TextbookGroup | null>(null)
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
    const draggingGroupRef = useRef<TextbookGroup | null>(null)

    // 드래그 상태 - 서브그룹
    const [draggingSubgroup, setDraggingSubgroup] = useState<TextbookSubgroup | null>(null)
    const [dragOverSubgroupId, setDragOverSubgroupId] = useState<string | null>(null)
    const draggingSubgroupRef = useRef<TextbookSubgroup | null>(null)

    // 드래그 상태 - 교재
    const [draggingTextbook, setDraggingTextbook] = useState<Textbook | null>(null)
    const [dragOverTextbookId, setDragOverTextbookId] = useState<string | null>(null)
    const draggingTextbookRef = useRef<Textbook | null>(null)

    // 현재 그룹의 서브그룹
    const currentSubgroups = useMemo(() => {
        if (!activeTab) return []
        return subgroups
            .filter(s => s.group_id === activeTab)
            .sort((a, b) => a.order_index - b.order_index)
    }, [activeTab, subgroups])

    // 필터링된 교재
    const filteredTextbooks = useMemo(() => {
        let filtered: Textbook[]
        if (activeTab === null) {
            filtered = [...textbooks]
        } else {
            filtered = textbooks.filter(t => t.group_id === activeTab)
        }
        return filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    }, [textbooks, activeTab])

    // 토글 함수들
    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            saveToSession(STORAGE_KEY_COLLAPSED_GROUPS, next)
            return next
        })
    }

    const toggleSubgroup = (subgroupId: string) => {
        setCollapsedSubgroups(prev => {
            const next = new Set(prev)
            if (next.has(subgroupId)) next.delete(subgroupId)
            else next.add(subgroupId)
            saveToSession(STORAGE_KEY_COLLAPSED_SUBGROUPS, next)
            return next
        })
    }

    // 템플릿 선택 시 폼에 적용
    const handleTemplateSelect = (templateId: string) => {
        if (!templateId) {
            setSelectedTemplateId(null)
            setTemplateChapters([])
            return
        }
        
        const template = templates.find(t => t.id === templateId)
        if (template) {
            setSelectedTemplateId(templateId)
            setTotalChapters(template.total_chapters)
            setChapterUnit(template.chapter_unit)
            setCustomUnit(template.custom_chapter_unit || '')
            setTemplateChapters(template.chapters || [])
        }
    }

    // 템플릿 저장 모달 열기
    const openSaveTemplateModal = (textbookId: string, textbookName: string) => {
        setSaveTemplateTextbookId(textbookId)
        setTemplateName(`${textbookName} 템플릿`)
        setShowSaveTemplateModal(true)
    }

    // 템플릿 저장
    const handleSaveTemplate = async (textbook: Textbook, chapters: TextbookChapter[]) => {
        if (!templateName.trim()) {
            alert('템플릿 이름을 입력해주세요.')
            return
        }
        
        try {
            await createTemplateFromTextbook(templateName.trim(), textbook, chapters)
            alert('템플릿이 저장되었습니다.')
            setShowSaveTemplateModal(false)
            setSaveTemplateTextbookId(null)
            setTemplateName('')
        } catch (error) {
            console.error('Error saving template:', error)
            alert('템플릿 저장에 실패했습니다.')
        }
    }

    // 템플릿 삭제
    const handleDeleteTemplate = async (templateId: string, templateName: string) => {
        if (!confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) return
        
        try {
            await deleteTemplate(templateId)
            if (selectedTemplateId === templateId) {
                setSelectedTemplateId(null)
                setTemplateChapters([])
            }
        } catch (error) {
            console.error('Error deleting template:', error)
            alert('템플릿 삭제에 실패했습니다.')
        }
    }

    // 그룹 드래그앤드롭
    const handleGroupDragStart = (group: TextbookGroup) => {
        draggingGroupRef.current = group
        setDraggingGroup(group)
    }

    const handleGroupDragEnd = () => {
        draggingGroupRef.current = null
        setDraggingGroup(null)
        setDragOverGroupId(null)
    }

    const handleGroupDrop = async (targetGroupId: string) => {
        const draggedGroup = draggingGroupRef.current
        if (!draggedGroup || draggedGroup.id === targetGroupId) {
            handleGroupDragEnd()
            return
        }

        const newGroups = [...groups]
        const draggedIndex = newGroups.findIndex(g => g.id === draggedGroup.id)
        const targetIndex = newGroups.findIndex(g => g.id === targetGroupId)

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = newGroups.splice(draggedIndex, 1)
            newGroups.splice(targetIndex, 0, removed)

            try {
                await onReorderGroups(newGroups)
            } catch (error) {
                console.error('Error reordering groups:', error)
            }
        }

        handleGroupDragEnd()
    }

    // 서브그룹 드래그앤드롭
    const handleSubgroupDragStart = (subgroup: TextbookSubgroup) => {
        draggingSubgroupRef.current = subgroup
        setDraggingSubgroup(subgroup)
    }

    const handleSubgroupDragEnd = () => {
        draggingSubgroupRef.current = null
        setDraggingSubgroup(null)
        setDragOverSubgroupId(null)
    }

    const handleSubgroupDrop = async (targetSubgroupId: string) => {
        const draggedSubgroup = draggingSubgroupRef.current
        if (!draggedSubgroup || draggedSubgroup.id === targetSubgroupId) {
            handleSubgroupDragEnd()
            return
        }

        const sameGroupSubgroups = currentSubgroups.filter(s => s.group_id === draggedSubgroup.group_id)
        const draggedIndex = sameGroupSubgroups.findIndex(s => s.id === draggedSubgroup.id)
        const targetIndex = sameGroupSubgroups.findIndex(s => s.id === targetSubgroupId)

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const newSubgroups = [...sameGroupSubgroups]
            const [removed] = newSubgroups.splice(draggedIndex, 1)
            newSubgroups.splice(targetIndex, 0, removed)

            try {
                await onReorderSubgroups(newSubgroups)
            } catch (error) {
                console.error('Error reordering subgroups:', error)
            }
        }

        handleSubgroupDragEnd()
    }

    // 교재 드래그앤드롭
    const handleTextbookDragStart = (textbook: Textbook) => {
        draggingTextbookRef.current = textbook
        setDraggingTextbook(textbook)
    }

    const handleTextbookDragEnd = () => {
        draggingTextbookRef.current = null
        setDraggingTextbook(null)
        setDragOverTextbookId(null)
    }

    const handleTextbookDragOver = (targetTextbookId: string) => {
        const dragged = draggingTextbookRef.current
        if (dragged && dragged.id !== targetTextbookId) {
            const target = textbooks.find(t => t.id === targetTextbookId)
            // 같은 그룹, 같은 서브그룹 내에서만 이동 가능
            if (target && dragged.group_id === target.group_id && dragged.subgroup_id === target.subgroup_id) {
                setDragOverTextbookId(targetTextbookId)
            }
        }
    }

    const handleTextbookDrop = async (targetTextbookId: string) => {
        const draggedTextbook = draggingTextbookRef.current
        if (!draggedTextbook || draggedTextbook.id === targetTextbookId) {
            handleTextbookDragEnd()
            return
        }

        // 같은 그룹/서브그룹의 교재만 필터
        const sameGroupTextbooks = textbooks.filter(
            t => t.group_id === draggedTextbook.group_id && t.subgroup_id === draggedTextbook.subgroup_id
        ).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

        const draggedIndex = sameGroupTextbooks.findIndex(t => t.id === draggedTextbook.id)
        const targetIndex = sameGroupTextbooks.findIndex(t => t.id === targetTextbookId)

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const newTextbooks = [...sameGroupTextbooks]
            const [removed] = newTextbooks.splice(draggedIndex, 1)
            newTextbooks.splice(targetIndex, 0, removed)

            try {
                await onReorderTextbooks(newTextbooks)
            } catch (error) {
                console.error('Error reordering textbooks:', error)
            }
        }

        handleTextbookDragEnd()
    }

    // 교재 생성
    const handleCreate = async () => {
        if (!name.trim()) {
            alert('교재명을 입력하세요.')
            return
        }

        if (totalChapters < 1 || totalChapters > 200) {
            alert('단원 수는 1~200 사이여야 합니다.')
            return
        }

        if (chapterUnit === '직접입력' && !customUnit.trim()) {
            alert('단원 단위를 입력하세요.')
            return
        }

        try {
            setIsCreating(true)
            const newTextbook = await onCreateTextbook({
                name: name.trim(),
                total_chapters: totalChapters,
                chapter_unit: chapterUnit,
                custom_chapter_unit: chapterUnit === '직접입력' ? customUnit.trim() : undefined,
                group_id: selectedGroupId || undefined,
                subgroup_id: selectedSubgroupId || undefined,
            })

            // 템플릿에서 단원 정보 적용
            if (selectedTemplateId && templateChapters.length > 0 && newTextbook) {
                const { supabase } = await import('@/lib/supabase')
                
                // 템플릿의 단원 정보를 새 교재에 적용
                const chapterInserts = templateChapters.map(ch => ({
                    textbook_id: newTextbook.id,
                    chapter_number: ch.chapter_number,
                    custom_name: ch.custom_name || null,
                    order_index: ch.chapter_number - 1
                }))

                if (chapterInserts.length > 0) {
                    await supabase
                        .from('textbook_chapters')
                        .insert(chapterInserts)
                }
            }

            setName('')
            setTotalChapters(10)
            setChapterUnit('강')
            setCustomUnit('')
            setSelectedTemplateId(null)
            setTemplateChapters([])
            setShowAddForm(false)
        } catch (error) {
            console.error('Error creating textbook:', error)
            alert('교재 추가에 실패했습니다.')
        } finally {
            setIsCreating(false)
        }
    }

    // 메모 모달 열기
    const openMemoModal = (id: string, name: string, type: 'subgroup' | 'textbook', memo: string) => {
        setMemoModalTarget({ id, name, type, memo })
        setMemoInput(memo || '')
        setShowMemoModal(true)
    }

    // 메모 저장
    const saveMemo = async () => {
        try {
            if (memoModalTarget.type === 'subgroup') {
                await onUpdateSubgroup(memoModalTarget.id, { memo: memoInput.trim() || null })
            } else {
                await onUpdateTextbookMemo(memoModalTarget.id, memoInput.trim() || null)
            }
            setShowMemoModal(false)
        } catch (error) {
            console.error('Error saving memo:', error)
            alert('메모 저장에 실패했습니다.')
        }
    }

    // 인라인 교재 추가 (수준 행에서 바로 추가)
    const handleInlineCreate = async (groupId: string, subgroupId: string) => {
        if (!inlineTextbookName.trim()) return
        
        try {
            await onCreateTextbook({
                name: inlineTextbookName.trim(),
                total_chapters: inlineChapterCount,
                chapter_unit: '강',
                group_id: groupId,
                subgroup_id: subgroupId,
            })
            // 초기화
            setInlineAddSubgroupId(null)
            setInlineTextbookName('')
            setInlineChapterCount(10)
        } catch (error) {
            console.error('Error creating textbook:', error)
            alert('교재 추가에 실패했습니다.')
        }
    }

    // 그룹 CRUD
    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return
        try {
            await onCreateGroup(newGroupName.trim())
            setNewGroupName('')
            setIsAddingGroup(false)
        } catch (error) {
            console.error('Error creating group:', error)
            alert('그룹 추가에 실패했습니다.')
        }
    }

    const handleUpdateGroup = async (id: string) => {
        if (!editingGroupName.trim()) {
            setEditingGroupId(null)
            return
        }
        try {
            await onUpdateGroup(id, editingGroupName.trim())
            setEditingGroupId(null)
            setEditingGroupName('')
        } catch (error) {
            console.error('Error updating group:', error)
            alert('그룹 수정에 실패했습니다.')
        }
    }

    const handleDeleteGroup = async (id: string, groupName: string) => {
        const groupTextbooks = textbooks.filter(t => t.group_id === id)
        const message = groupTextbooks.length > 0
            ? `"${groupName}" 그룹을 삭제하시겠습니까?\n\n⚠️ 이 그룹에 속한 ${groupTextbooks.length}개의 교재는 미분류로 이동합니다.`
            : `"${groupName}" 그룹을 삭제하시겠습니까?`

        if (!confirm(message)) return

        try {
            await onDeleteGroup(id)
            if (activeTab === id) setActiveTab(null)
        } catch (error) {
            console.error('Error deleting group:', error)
            alert('그룹 삭제에 실패했습니다.')
        }
    }

    // 서브그룹 CRUD
    const handleAddSubgroup = async () => {
        if (!newSubgroupName.trim() || !activeTab) return
        try {
            await onCreateSubgroup(activeTab, newSubgroupName.trim())
            setNewSubgroupName('')
            setIsAddingSubgroup(false)
        } catch (error) {
            console.error('Error creating subgroup:', error)
            alert('수준 추가에 실패했습니다.')
        }
    }

    const handleUpdateSubgroup = async (id: string) => {
        if (!editingSubgroupName.trim()) {
            setEditingSubgroupId(null)
            return
        }
        try {
            await onUpdateSubgroup(id, { name: editingSubgroupName.trim() })
            setEditingSubgroupId(null)
            setEditingSubgroupName('')
        } catch (error) {
            console.error('Error updating subgroup:', error)
            alert('수준 수정에 실패했습니다.')
        }
    }

    const handleDeleteSubgroup = async (id: string, subgroupName: string) => {
        const subgroupTextbooks = textbooks.filter(t => t.subgroup_id === id)
        const message = subgroupTextbooks.length > 0
            ? `"${subgroupName}" 수준을 삭제하시겠습니까?\n\n⚠️ 이 수준에 속한 ${subgroupTextbooks.length}개의 교재는 수준 미지정으로 변경됩니다.`
            : `"${subgroupName}" 수준을 삭제하시겠습니까?`

        if (!confirm(message)) return

        try {
            await onDeleteSubgroup(id)
        } catch (error) {
            console.error('Error deleting subgroup:', error)
            alert('수준 삭제에 실패했습니다.')
        }
    }

    // 단원 단위 표시
    const getChapterUnitDisplay = (textbook: Textbook) => {
        return textbook.chapter_unit === '직접입력' 
            ? textbook.custom_chapter_unit 
            : textbook.chapter_unit
    }

    // 교재 아이템 렌더링
    const renderTextbookItem = (textbook: Textbook) => {
        const isDragging = draggingTextbook?.id === textbook.id
        const isDragOver = dragOverTextbookId === textbook.id
        const isExpanded = expandedTextbooks.has(textbook.id)
        const chapterUnit = getChapterUnitDisplay(textbook) || '강'

        return (
            <div key={textbook.id} className="space-y-1">
                <div
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-all ${
                        isDragging 
                            ? 'opacity-50 border-blue-400 bg-blue-50' 
                            : isDragOver
                                ? 'border-2 border-blue-500 border-dashed bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        handleTextbookDragStart(textbook)
                    }}
                    onDragEnd={handleTextbookDragEnd}
                    onDragOver={(e) => {
                        e.preventDefault()
                        handleTextbookDragOver(textbook.id)
                    }}
                    onDrop={(e) => {
                        e.preventDefault()
                        handleTextbookDrop(textbook.id)
                    }}
                >
                    <GripVertical size={14} className="text-gray-400 cursor-grab" />
                    
                    {/* 단원 보기 토글 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleTextbook(textbook.id)
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-600" />
                        ) : (
                            <ChevronRight size={16} className="text-gray-500" />
                        )}
                    </button>
                    
                    <BookOpen size={16} className="text-blue-600" />
                    {editingTextbookId === textbook.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                type="text"
                                value={editingTextbookName}
                                onChange={e => setEditingTextbookName(e.target.value)}
                                className="px-2 py-0.5 text-sm border border-blue-400 rounded font-medium"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && editingTextbookName.trim()) {
                                        onUpdateTextbookName(textbook.id, editingTextbookName.trim())
                                        setEditingTextbookId(null)
                                    }
                                    if (e.key === 'Escape') setEditingTextbookId(null)
                                }}
                                onBlur={() => {
                                    if (editingTextbookName.trim() && editingTextbookName !== textbook.name) {
                                        onUpdateTextbookName(textbook.id, editingTextbookName.trim())
                                    }
                                    setEditingTextbookId(null)
                                }}
                            />
                        </div>
                    ) : (
                        <span 
                            className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                            onDoubleClick={e => {
                                e.stopPropagation()
                                setEditingTextbookId(textbook.id)
                                setEditingTextbookName(textbook.name)
                            }}
                            title="더블클릭하여 수정"
                        >
                            {textbook.name}
                        </span>
                    )}
                    
                    {/* 폴더 경로 버튼 - 교재명 옆 */}
                    {editingPathId === textbook.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                type="text"
                                value={pathInput}
                                onChange={e => setPathInput(e.target.value)}
                                placeholder="경로 붙여넣기"
                                className="w-32 px-2 py-0.5 text-xs border border-blue-400 rounded"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && pathInput.trim()) {
                                        onUpdateTextbookLocalPath(textbook.id, pathInput.trim())
                                        setEditingPathId(null)
                                    }
                                    if (e.key === 'Escape') setEditingPathId(null)
                                }}
                            />
                            <button
                                onClick={() => {
                                    if (pathInput.trim()) {
                                        onUpdateTextbookLocalPath(textbook.id, pathInput.trim())
                                    }
                                    setEditingPathId(null)
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                                <Check size={12} />
                            </button>
                        </div>
                    ) : textbook.local_path ? (
                        <button
                            onClick={e => {
                                e.stopPropagation()
                                openLocalFolder(textbook.local_path!)
                            }}
                            onContextMenu={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                setPathInput(textbook.local_path || '')
                                setEditingPathId(textbook.id)
                            }}
                            className="px-2 py-0.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded flex items-center gap-1"
                            title="클릭: 폴더 열기 | 우클릭: 수정"
                        >
                            <FolderOpen size={12} />
                        </button>
                    ) : (
                        <button
                            onClick={e => {
                                e.stopPropagation()
                                setPathInput('')
                                setEditingPathId(textbook.id)
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
                            title="폴더 경로 등록"
                        >
                            <FolderOpen size={14} />
                        </button>
                    )}
                    
                    <span className="flex-1" />
                    <span className="text-sm text-gray-500">
                        ({textbook.total_chapters}{chapterUnit})
                    </span>
                    
                    {/* 그룹 선택 */}
                    <select
                        value={textbook.group_id || ''}
                        onChange={(e) => onUpdateTextbookGroup(textbook.id, e.target.value || null)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-2 py-1 border border-gray-200 rounded bg-white"
                >
                    <option value="">미분류</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>

                {/* 서브그룹 선택 (그룹이 선택된 경우에만) */}
                {textbook.group_id && (
                    <select
                        value={textbook.subgroup_id || ''}
                        onChange={(e) => onUpdateTextbookSubgroup(textbook.id, e.target.value || null)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white"
                    >
                        <option value="">수준</option>
                        {subgroups
                            .filter(s => s.group_id === textbook.group_id)
                            .map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))
                        }
                    </select>
                )}

                {/* 단원 수 조절 */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (textbook.total_chapters > 1) {
                                onUpdateTextbookChapters(textbook.id, textbook.total_chapters - 1)
                            }
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (textbook.total_chapters < 200) {
                                onUpdateTextbookChapters(textbook.id, textbook.total_chapters + 1)
                            }
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                {/* 메모 버튼 */}
                {textbook.memo ? (
                    <button
                        onClick={e => {
                            e.stopPropagation()
                            openMemoModal(textbook.id, textbook.name, 'textbook', textbook.memo || '')
                        }}
                        className="px-2 py-0.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded flex items-center gap-1 max-w-[100px]"
                        title={textbook.memo}
                    >
                        <MessageSquare size={12} />
                        <span className="truncate">{textbook.memo}</span>
                    </button>
                ) : (
                    <button
                        onClick={e => {
                            e.stopPropagation()
                            openMemoModal(textbook.id, textbook.name, 'textbook', '')
                        }}
                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded"
                        title="메모 추가"
                    >
                        <MessageSquare size={14} />
                    </button>
                )}

                {/* 템플릿으로 저장 */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        openSaveTemplateModal(textbook.id, textbook.name)
                    }}
                    className="p-1 text-gray-400 hover:text-green-500 rounded"
                    title="템플릿으로 저장"
                >
                    <Save size={14} />
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`"${textbook.name}" 교재를 삭제하시겠습니까?`)) {
                            onDeleteTextbook(textbook.id)
                        }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                    <Trash2 size={14} />
                </button>
                </div>

                {/* 단원 목록 (펼쳐진 경우) */}
                {isExpanded && (
                    <ChapterList 
                        textbook={textbook} 
                        chapterUnit={chapterUnit}
                        onUpdateTotalChapters={onUpdateTextbookChapters}
                    />
                )}
            </div>
        )
    }

    // 단원 목록 컴포넌트
    function ChapterList({ textbook, chapterUnit, onUpdateTotalChapters }: { 
        textbook: Textbook, 
        chapterUnit: string,
        onUpdateTotalChapters: (id: string, totalChapters: number) => Promise<Textbook>
    }) {
        const { 
            chapters, 
            loading, 
            fetchChapters,
            updateChapterName, 
            addChapter, 
            deleteChapter, 
            reorderChapters 
        } = useTextbookChapters(textbook.id)
        
        const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
        const [editingName, setEditingName] = useState('')
        const [draggingChapter, setDraggingChapter] = useState<TextbookChapter | null>(null)
        const [dragOverChapterId, setDragOverChapterId] = useState<string | null>(null)
        const draggingChapterRef = useRef<TextbookChapter | null>(null)

        // 표시할 단원 목록 (DB 데이터 + 기본 생성 병합)
        const displayChapters = useMemo(() => {
            // DB에 저장된 단원 정보와 기본 단원 목록 병합
            const result: TextbookChapter[] = []
            
            for (let i = 0; i < textbook.total_chapters; i++) {
                const chapterNumber = i + 1
                const existingChapter = chapters.find(c => c.chapter_number === chapterNumber)
                
                if (existingChapter) {
                    result.push(existingChapter)
                } else {
                    // DB에 없으면 임시 데이터 생성
                    result.push({
                        id: `temp-${i}`,
                        textbook_id: textbook.id,
                        chapter_number: chapterNumber,
                        order_index: i,
                        custom_name: undefined,
                        memo: undefined,
                        created_at: '',
                        updated_at: ''
                    } as TextbookChapter)
                }
            }
            
            return result.sort((a, b) => (a.order_index ?? a.chapter_number) - (b.order_index ?? b.chapter_number))
        }, [chapters, textbook.total_chapters, textbook.id])

        // 단원명 수정 시작 (임시 단원이면 먼저 DB에 저장)
        const startEditing = async (chapter: TextbookChapter, chapterNumber: number) => {
            const isTemp = chapter.id.startsWith('temp-')
            
            if (isTemp) {
                // 임시 단원이면 먼저 DB에 빈 이름으로 저장
                try {
                    const savedChapter = await updateChapterName(chapterNumber, '')
                    setEditingChapterId(savedChapter.id)
                    setEditingName('')
                } catch (error) {
                    console.error('Error creating chapter:', error)
                    return
                }
            } else {
                setEditingChapterId(chapter.id)
                setEditingName(chapter.custom_name || '')
            }
        }

        // 단원명 저장
        const saveChapterName = async (chapterNumber: number) => {
            if (editingChapterId) {
                try {
                    await updateChapterName(chapterNumber, editingName.trim())
                } catch (error) {
                    console.error('Error saving chapter name:', error)
                }
            }
            setEditingChapterId(null)
            setEditingName('')
        }

        // 단원 추가
        const handleAddChapter = async (insertIndex: number) => {
            try {
                await addChapter(textbook.id, insertIndex)
                await onUpdateTotalChapters(textbook.id, textbook.total_chapters + 1)
            } catch (error) {
                console.error('Error adding chapter:', error)
                alert('단원 추가에 실패했습니다.')
            }
        }

        // 단원 삭제
        const handleDeleteChapter = async (chapter: TextbookChapter, chapterNumber: number) => {
            if (!confirm('이 단원을 삭제하시겠습니까?')) return
            
            const isTemp = chapter.id.startsWith('temp-')
            
            try {
                if (!isTemp) {
                    // DB에 저장된 단원이면 삭제
                    await deleteChapter(chapter.id)
                }
                // 총 단원 수 감소
                await onUpdateTotalChapters(textbook.id, textbook.total_chapters - 1)
            } catch (error) {
                console.error('Error deleting chapter:', error)
                alert('단원 삭제에 실패했습니다.')
            }
        }

        // 드래그 시작
        const handleChapterDragStart = (chapter: TextbookChapter) => {
            draggingChapterRef.current = chapter
            setDraggingChapter(chapter)
        }

        // 드래그 종료
        const handleChapterDragEnd = () => {
            draggingChapterRef.current = null
            setDraggingChapter(null)
            setDragOverChapterId(null)
        }

        // 드래그 오버
        const handleChapterDragOver = (chapterId: string) => {
            if (draggingChapterRef.current && draggingChapterRef.current.id !== chapterId) {
                setDragOverChapterId(chapterId)
            }
        }

        // 드롭
        const handleChapterDrop = async (targetId: string) => {
            const dragging = draggingChapterRef.current
            if (!dragging || dragging.id === targetId) return

            const currentChapters = [...displayChapters]
            const dragIndex = currentChapters.findIndex(c => c.id === dragging.id)
            const dropIndex = currentChapters.findIndex(c => c.id === targetId)

            if (dragIndex === -1 || dropIndex === -1) return

            // 배열에서 드래그 항목 제거 후 새 위치에 삽입
            currentChapters.splice(dragIndex, 1)
            currentChapters.splice(dropIndex, 0, dragging)

            try {
                await reorderChapters(currentChapters)
            } catch (error) {
                console.error('Error reordering chapters:', error)
            }

            handleChapterDragEnd()
        }

        if (loading) {
            return (
                <div className="ml-8 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-500">로딩 중...</div>
                </div>
            )
        }

        return (
            <div className="ml-8 p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                {/* 맨 위에 추가 버튼 */}
                <button
                    onClick={() => handleAddChapter(0)}
                    className="w-full py-1 text-xs text-gray-400 hover:text-blue-500 border border-dashed border-gray-300 rounded hover:border-blue-400 transition-colors"
                >
                    + 맨 위에 단원 추가
                </button>

                {/* 단원 목록 */}
                {displayChapters.map((chapter, index) => {
                    // chapter.chapter_number를 사용하여 원래 단원 번호 유지
                    const originalChapterNumber = chapter.chapter_number
                    const isDragging = draggingChapter?.id === chapter.id
                    const isDragOver = dragOverChapterId === chapter.id
                    const isEditing = editingChapterId === chapter.id || 
                                      (editingChapterId && chapters.find(c => c.id === editingChapterId)?.chapter_number === originalChapterNumber)

                    return (
                        <div key={chapter.id}>
                            <div
                                className={`flex items-center gap-2 py-1.5 px-2 bg-white rounded border transition-all ${
                                    isDragging 
                                        ? 'opacity-50 border-blue-400' 
                                        : isDragOver
                                            ? 'border-2 border-blue-500 border-dashed'
                                            : 'border-gray-200 hover:bg-gray-50'
                                }`}
                                draggable
                                onDragStart={() => handleChapterDragStart(chapter)}
                                onDragEnd={handleChapterDragEnd}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    handleChapterDragOver(chapter.id)
                                }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    handleChapterDrop(chapter.id)
                                }}
                            >
                                {/* 드래그 핸들 */}
                                <GripVertical size={12} className="text-gray-400 cursor-grab" />
                                
                                {/* 단원명 */}
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => saveChapterName(originalChapterNumber)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveChapterName(originalChapterNumber)
                                            if (e.key === 'Escape') {
                                                setEditingChapterId(null)
                                                setEditingName('')
                                            }
                                        }}
                                        className="flex-1 px-2 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        placeholder={`${originalChapterNumber}${chapterUnit}`}
                                        autoFocus
                                    />
                                ) : (
                                    <span 
                                        className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                                        onClick={() => startEditing(chapter, originalChapterNumber)}
                                    >
                                        {chapter.custom_name || `${originalChapterNumber}${chapterUnit}`}
                                    </span>
                                )}

                                {/* 수정 버튼 */}
                                {!isEditing && (
                                    <button
                                        onClick={() => startEditing(chapter, originalChapterNumber)}
                                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                                        title="단원명 수정"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                )}

                                {/* 삭제 버튼 */}
                                <button
                                    onClick={() => handleDeleteChapter(chapter, originalChapterNumber)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                    title="단원 삭제"
                                >
                                    <Trash2 size={12} />
                                </button>

                                {/* 아래에 추가 버튼 */}
                                <button
                                    onClick={() => handleAddChapter(index + 1)}
                                    className="p-1 text-gray-400 hover:text-green-500 rounded transition-colors"
                                    title="아래에 단원 추가"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                    )
                })}

                {displayChapters.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-400">
                        단원이 없습니다. 위 버튼을 클릭하여 추가하세요.
                    </div>
                )}
            </div>
        )
    }

    // 전체 탭에서 그룹별 렌더링
    const renderAllTextbooks = () => {
        // 그룹별로 교재 분류
        const groupedTextbooks: Record<string, Textbook[]> = {}
        const uncategorized: Textbook[] = []
        
        // 현재 존재하는 그룹 ID Set
        const existingGroupIds = new Set(groups.map(g => g.id))

        textbooks.forEach(t => {
            if (t.group_id && existingGroupIds.has(t.group_id)) {
                // 그룹이 존재하는 경우에만 해당 그룹에 분류
                if (!groupedTextbooks[t.group_id]) groupedTextbooks[t.group_id] = []
                groupedTextbooks[t.group_id].push(t)
            } else {
                // 그룹이 없거나 삭제된 그룹인 경우 미분류
                uncategorized.push(t)
            }
        })

        return (
            <div className="space-y-3">
                {/* 그룹별 섹션 */}
                {groups.map(group => {
                    const groupTextbooks = groupedTextbooks[group.id] || []
                    const groupSubgroups = subgroups
                        .filter(s => s.group_id === group.id)
                        .sort((a, b) => a.order_index - b.order_index)
                    const isCollapsed = collapsedGroups.has(group.id)

                    if (groupTextbooks.length === 0) return null

                    return (
                        <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* 그룹 헤더 */}
                            <div 
                                className="flex items-center gap-2 py-2 px-3 bg-gray-100 cursor-pointer hover:bg-gray-200"
                                onClick={() => toggleGroup(group.id)}
                            >
                                {isCollapsed ? (
                                    <ChevronRight size={16} className="text-gray-600" />
                                ) : (
                                    <ChevronDown size={16} className="text-gray-600" />
                                )}
                                <BookOpen size={16} className="text-blue-600" />
                                <span className="font-bold text-gray-900">{group.name}</span>
                                <span className="text-sm text-gray-500">({groupTextbooks.length})</span>
                            </div>

                            {/* 그룹 내용 */}
                            {!isCollapsed && (
                                <div className="p-2 space-y-2">
                                    {groupSubgroups.length > 0 ? (
                                        // 서브그룹이 있는 경우
                                        <>
                                            {groupSubgroups.map(subgroup => {
                                                const subgroupTextbooks = groupTextbooks
                                                    .filter(t => t.subgroup_id === subgroup.id)
                                                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                                const isSubgroupCollapsed = collapsedSubgroups.has(subgroup.id)

                                                if (subgroupTextbooks.length === 0) return null

                                                return (
                                                    <div key={subgroup.id} className="ml-4">
                                                        <div 
                                                            className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-50"
                                                            onClick={() => toggleSubgroup(subgroup.id)}
                                                        >
                                                            {isSubgroupCollapsed ? (
                                                                <ChevronRight size={14} className="text-gray-500" />
                                                            ) : (
                                                                <ChevronDown size={14} className="text-gray-500" />
                                                            )}
                                                            <span className="font-medium text-gray-700">{subgroup.name}</span>
                                                            <span className="text-xs text-gray-400">({subgroupTextbooks.length})</span>
                                                        </div>
                                                        {!isSubgroupCollapsed && (
                                                            <div className="ml-4 space-y-1 mt-1">
                                                                {subgroupTextbooks.map(renderTextbookItem)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            {/* 수준 미지정 교재 */}
                                            {(() => {
                                                const unassigned = groupTextbooks.filter(t => !t.subgroup_id)
                                                if (unassigned.length === 0) return null
                                                return (
                                                    <div className="ml-4">
                                                        <div className="flex items-center gap-2 py-1 px-2 text-gray-400 text-sm">
                                                            <span>─ 미지정 ({unassigned.length})</span>
                                                        </div>
                                                        <div className="ml-4 space-y-1">
                                                            {unassigned.map(renderTextbookItem)}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </>
                                    ) : (
                                        // 서브그룹이 없는 경우
                                        <div className="space-y-1">
                                            {groupTextbooks
                                                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                                .map(renderTextbookItem)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* 미분류 교재 */}
                {uncategorized.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                            className="flex items-center gap-2 py-2 px-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleGroup('uncategorized')}
                        >
                            {collapsedGroups.has('uncategorized') ? (
                                <ChevronRight size={16} className="text-gray-500" />
                            ) : (
                                <ChevronDown size={16} className="text-gray-500" />
                            )}
                            <BookOpen size={16} className="text-gray-500" />
                            <span className="font-bold text-gray-700">미분류</span>
                            <span className="text-sm text-gray-500">({uncategorized.length})</span>
                        </div>
                        {!collapsedGroups.has('uncategorized') && (
                            <div className="p-2 space-y-1">
                                {uncategorized
                                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                    .map(renderTextbookItem)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // 메모 추적 뷰 렌더링
    const renderMemoView = () => {
        // 모든 메모 수집
        const allMemos: { type: 'subgroup' | 'textbook' | 'chapter'; id: string; name: string; memo: string; parent?: string }[] = []
        
        // 수준별 메모
        subgroups.forEach(sg => {
            if (sg.memo) {
                const group = groups.find(g => g.id === sg.group_id)
                allMemos.push({
                    type: 'subgroup',
                    id: sg.id,
                    name: sg.name,
                    memo: sg.memo,
                    parent: group?.name
                })
            }
        })
        
        // 교재별 메모
        textbooks.forEach(tb => {
            if (tb.memo) {
                const subgroup = subgroups.find(s => s.id === tb.subgroup_id)
                const group = groups.find(g => g.id === tb.group_id)
                allMemos.push({
                    type: 'textbook',
                    id: tb.id,
                    name: tb.name,
                    memo: tb.memo,
                    parent: subgroup?.name || group?.name
                })
            }
        })
        
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare size={20} className="text-green-600" />
                        메모 추적
                    </h3>
                    <span className="text-sm text-gray-500">총 {allMemos.length}개 메모</span>
                </div>
                
                {allMemos.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                        <p>등록된 메모가 없습니다</p>
                        <p className="text-sm mt-1">수준이나 교재에 메모를 추가해보세요</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {allMemos.map((item, idx) => (
                            <div 
                                key={`${item.type}-${item.id}-${idx}`}
                                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-1.5 rounded ${
                                        item.type === 'subgroup' 
                                            ? 'bg-purple-100 text-purple-600' 
                                            : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        {item.type === 'subgroup' ? (
                                            <ChevronRight size={16} />
                                        ) : (
                                            <BookOpen size={16} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900">{item.name}</span>
                                            {item.parent && (
                                                <span className="text-xs text-gray-400">({item.parent})</span>
                                            )}
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                item.type === 'subgroup'
                                                    ? 'bg-purple-50 text-purple-600'
                                                    : 'bg-blue-50 text-blue-600'
                                            }`}>
                                                {item.type === 'subgroup' ? '수준' : '교재'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 bg-green-50 px-2 py-1 rounded">
                                            {item.memo}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            openMemoModal(item.id, item.name, item.type as 'subgroup' | 'textbook', item.memo)
                                        }}
                                        className="p-1 text-gray-400 hover:text-green-600 rounded"
                                        title="수정"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // 특정 그룹 탭에서 서브그룹별 렌더링
    const renderGroupTextbooks = () => {
        if (!activeTab) return null

        const groupTextbooks = filteredTextbooks
        const groupSubgroups = currentSubgroups

        return (
            <div className="space-y-3">
                {/* 서브그룹 관리 영역 */}
                <div className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-500 font-medium">수준:</span>
                    
                    {groupSubgroups.map(subgroup => {
                        const isEditing = editingSubgroupId === subgroup.id
                        const count = groupTextbooks.filter(t => t.subgroup_id === subgroup.id).length
                        const isDragging = draggingSubgroup?.id === subgroup.id
                        const isDragOver = dragOverSubgroupId === subgroup.id

                        return (
                            <div 
                                key={subgroup.id} 
                                className={`relative group/subgroup ${isDragging ? 'opacity-50' : ''}`}
                                draggable={!isEditing}
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move'
                                    handleSubgroupDragStart(subgroup)
                                }}
                                onDragEnd={handleSubgroupDragEnd}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    if (draggingSubgroupRef.current && draggingSubgroupRef.current.id !== subgroup.id) {
                                        setDragOverSubgroupId(subgroup.id)
                                    }
                                }}
                                onDragLeave={() => setDragOverSubgroupId(null)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    handleSubgroupDrop(subgroup.id)
                                }}
                            >
                                {isEditing ? (
                                    <div className="flex items-center gap-1 bg-white border border-blue-500 rounded px-2 py-1">
                                        <input
                                            type="text"
                                            value={editingSubgroupName}
                                            onChange={(e) => setEditingSubgroupName(e.target.value)}
                                            className="w-20 text-xs border-none focus:outline-none"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateSubgroup(subgroup.id)
                                                if (e.key === 'Escape') setEditingSubgroupId(null)
                                            }}
                                        />
                                        <button onClick={() => handleUpdateSubgroup(subgroup.id)} className="p-0.5 text-blue-600">
                                            <Check size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className={`flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs cursor-grab group ${
                                        isDragOver ? 'border-blue-500 border-dashed bg-blue-50' : 'border-gray-200 hover:border-gray-400'
                                    }`}>
                                        <GripVertical size={10} className="text-gray-400" />
                                        <span className="text-gray-700">{subgroup.name}</span>
                                        <span className="text-gray-400">({count})</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingSubgroupId(subgroup.id)
                                                setEditingSubgroupName(subgroup.name)
                                            }}
                                            className="p-0.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="수정"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteSubgroup(subgroup.id, subgroup.name)
                                            }}
                                            className="p-0.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="삭제"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* 수준 추가 */}
                    {isAddingSubgroup ? (
                        <div className="flex items-center gap-1 bg-white border border-blue-500 rounded px-2 py-1">
                            <input
                                type="text"
                                value={newSubgroupName}
                                onChange={(e) => setNewSubgroupName(e.target.value)}
                                placeholder="수준명"
                                className="w-20 text-xs border-none focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddSubgroup()
                                    if (e.key === 'Escape') { setIsAddingSubgroup(false); setNewSubgroupName('') }
                                }}
                            />
                            <button onClick={handleAddSubgroup} className="p-0.5 text-blue-600">
                                <Check size={12} />
                            </button>
                            <button onClick={() => { setIsAddingSubgroup(false); setNewSubgroupName('') }} className="p-0.5 text-gray-400">
                                <X size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingSubgroup(true)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-300 border-dashed rounded flex items-center gap-1"
                        >
                            <Plus size={10} />
                            수준
                        </button>
                    )}
                </div>

                {/* 서브그룹별 교재 목록 */}
                {groupSubgroups.length > 0 ? (
                    <>
                        {groupSubgroups.map(subgroup => {
                            const subgroupTextbooks = groupTextbooks
                                .filter(t => t.subgroup_id === subgroup.id)
                                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                            const isCollapsed = collapsedSubgroups.has(subgroup.id)
                            return (
                                <div key={subgroup.id}>
                                    <div 
                                        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-gray-50 rounded"
                                        onClick={() => toggleSubgroup(subgroup.id)}
                                    >
                                        {isCollapsed ? (
                                            <ChevronRight size={14} className="text-gray-500" />
                                        ) : (
                                            <ChevronDown size={14} className="text-gray-500" />
                                        )}
                                        <span className="font-medium text-gray-800">{subgroup.name}</span>
                                        <span className="text-sm text-gray-500">({subgroupTextbooks.length})</span>
                                        
                                        {/* 폴더 경로 버튼 - 수준명 옆 */}
                                        {editingPathId === subgroup.id ? (
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={pathInput}
                                                    onChange={e => setPathInput(e.target.value)}
                                                    placeholder="경로 붙여넣기"
                                                    className="w-40 px-2 py-0.5 text-xs border border-blue-400 rounded"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && pathInput.trim()) {
                                                            onUpdateSubgroup(subgroup.id, { local_path: pathInput.trim() })
                                                            setEditingPathId(null)
                                                        }
                                                        if (e.key === 'Escape') setEditingPathId(null)
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (pathInput.trim()) {
                                                            onUpdateSubgroup(subgroup.id, { local_path: pathInput.trim() })
                                                        }
                                                        setEditingPathId(null)
                                                    }}
                                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                                >
                                                    <Check size={12} />
                                                </button>
                                            </div>
                                        ) : subgroup.local_path ? (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    openLocalFolder(subgroup.local_path!)
                                                }}
                                                onContextMenu={e => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setPathInput(subgroup.local_path || '')
                                                    setEditingPathId(subgroup.id)
                                                }}
                                                className="px-2 py-0.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded flex items-center gap-1"
                                                title="클릭: 폴더 열기 | 우클릭: 수정"
                                            >
                                                <FolderOpen size={12} />
                                                <span className="max-w-[120px] truncate">
                                                    {subgroup.local_path.split('\\').pop()}
                                                </span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    setPathInput('')
                                                    setEditingPathId(subgroup.id)
                                                }}
                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
                                                title="폴더 경로 등록"
                                            >
                                                <FolderOpen size={14} />
                                            </button>
                                        )}
                                        
                                        <div className="flex-1 border-b border-gray-200 ml-1" />
                                        
                                        {/* 메모 버튼 */}
                                        {subgroup.memo ? (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    openMemoModal(subgroup.id, subgroup.name, 'subgroup', subgroup.memo || '')
                                                }}
                                                className="px-2 py-0.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded flex items-center gap-1 max-w-[150px]"
                                                title={subgroup.memo}
                                            >
                                                <MessageSquare size={12} />
                                                <span className="truncate">{subgroup.memo}</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    openMemoModal(subgroup.id, subgroup.name, 'subgroup', '')
                                                }}
                                                className="p-1 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded"
                                                title="메모 추가"
                                            >
                                                <MessageSquare size={14} />
                                            </button>
                                        )}
                                        
                                        {/* 인라인 교재 추가 버튼 */}
                                        {inlineAddSubgroupId === subgroup.id ? (
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={inlineTextbookName}
                                                    onChange={e => setInlineTextbookName(e.target.value)}
                                                    placeholder="교재명"
                                                    className="w-24 px-2 py-0.5 text-xs border border-blue-400 rounded"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && inlineTextbookName.trim()) {
                                                            handleInlineCreate(subgroup.group_id, subgroup.id)
                                                        }
                                                        if (e.key === 'Escape') setInlineAddSubgroupId(null)
                                                    }}
                                                />
                                                <input
                                                    type="number"
                                                    value={inlineChapterCount}
                                                    onChange={e => setInlineChapterCount(Number(e.target.value))}
                                                    className="w-12 px-1 py-0.5 text-xs border border-blue-400 rounded text-center"
                                                    min={1}
                                                    max={200}
                                                />
                                                <span className="text-xs text-gray-500">강</span>
                                                <button
                                                    onClick={() => handleInlineCreate(subgroup.group_id, subgroup.id)}
                                                    disabled={!inlineTextbookName.trim()}
                                                    className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                                                >
                                                    추가
                                                </button>
                                                <button
                                                    onClick={() => setInlineAddSubgroupId(null)}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    setInlineAddSubgroupId(subgroup.id)
                                                    setInlineTextbookName('')
                                                    setInlineChapterCount(10)
                                                }}
                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="교재 바로 추가"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <div className="space-y-1 ml-4 mb-2">
                                            {subgroupTextbooks.length === 0 ? (
                                                <div className="text-center py-3 text-gray-400 text-sm border border-dashed border-gray-200 rounded">
                                                    교재가 없습니다
                                                </div>
                                            ) : (
                                                subgroupTextbooks.map(renderTextbookItem)
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* 수준 미지정 */}
                        {(() => {
                            const unassigned = groupTextbooks.filter(t => !t.subgroup_id)
                            if (unassigned.length === 0) return null

                            const isCollapsed = collapsedSubgroups.has('unassigned')

                            return (
                                <div>
                                    <div 
                                        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-gray-50 rounded"
                                        onClick={() => toggleSubgroup('unassigned')}
                                    >
                                        {isCollapsed ? (
                                            <ChevronRight size={14} className="text-gray-400" />
                                        ) : (
                                            <ChevronDown size={14} className="text-gray-400" />
                                        )}
                                        <span className="text-gray-500">미지정</span>
                                        <span className="text-sm text-gray-400">({unassigned.length})</span>
                                        <div className="flex-1 border-b border-gray-100 ml-1" />
                                    </div>
                                    {!isCollapsed && (
                                        <div className="space-y-1 ml-4">
                                            {unassigned.map(renderTextbookItem)}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </>
                ) : (
                    // 서브그룹이 없는 경우
                    <div className="space-y-1">
                        {groupTextbooks.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
                                <p>이 그룹에 교재가 없습니다</p>
                            </div>
                        ) : (
                            groupTextbooks.map(renderTextbookItem)
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <BookOpen size={22} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">교재 관리</h2>
                        <span className="text-sm text-gray-400">({textbooks.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowMemoView(!showMemoView)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1 ${
                                showMemoView 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                        >
                            <MessageSquare size={16} />
                            {showMemoView ? '목록 보기' : '메모 추적'}
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
                        >
                            <Plus size={16} />
                            교재 추가
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 그룹 탭 */}
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* 전체 탭 */}
                        <button
                            onClick={() => setActiveTab(null)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === null
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                        >
                            전체 ({textbooks.length})
                        </button>

                        {/* 그룹 탭들 */}
                        {groups.map(group => {
                            const count = textbooks.filter(t => t.group_id === group.id).length
                            const isEditing = editingGroupId === group.id
                            const isDragging = draggingGroup?.id === group.id
                            const isDragOver = dragOverGroupId === group.id

                            return (
                                <div 
                                    key={group.id} 
                                    className={`relative group/tab ${isDragging ? 'opacity-50' : ''}`}
                                    draggable={!isEditing}
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move'
                                        handleGroupDragStart(group)
                                    }}
                                    onDragEnd={handleGroupDragEnd}
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        if (draggingGroupRef.current && draggingGroupRef.current.id !== group.id) {
                                            setDragOverGroupId(group.id)
                                        }
                                    }}
                                    onDragLeave={() => setDragOverGroupId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        handleGroupDrop(group.id)
                                    }}
                                >
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white border border-blue-500 rounded-lg px-2 py-1">
                                            <input
                                                type="text"
                                                value={editingGroupName}
                                                onChange={(e) => setEditingGroupName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateGroup(group.id)
                                                    if (e.key === 'Escape') setEditingGroupId(null)
                                                }}
                                                className="w-16 text-sm border-none focus:outline-none"
                                                autoFocus
                                            />
                                            <button onClick={() => handleUpdateGroup(group.id)} className="p-0.5 text-green-600">
                                                <Check size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-grab flex items-center gap-1 ${
                                                isDragOver
                                                    ? 'bg-blue-200 border-2 border-blue-500 border-dashed'
                                                    : activeTab === group.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                            }`}
                                            onClick={() => setActiveTab(group.id)}
                                        >
                                            <GripVertical size={12} className="opacity-50" />
                                            {group.name} ({count})
                                        </div>
                                    )}
                                    
                                    {/* 수정/삭제 버튼 */}
                                    {!isEditing && (
                                        <div className="absolute -top-2 -right-2 hidden group-hover/tab:flex gap-0.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setEditingGroupId(group.id)
                                                    setEditingGroupName(group.name)
                                                }}
                                                className="p-0.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                                            >
                                                <Edit2 size={10} className="text-gray-600" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDeleteGroup(group.id, group.name)
                                                }}
                                                className="p-0.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50"
                                            >
                                                <X size={10} className="text-red-500" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* 그룹 추가 */}
                        {isAddingGroup ? (
                            <div className="flex items-center gap-1 bg-white border border-blue-500 rounded-lg px-2 py-1">
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddGroup()
                                        if (e.key === 'Escape') {
                                            setIsAddingGroup(false)
                                            setNewGroupName('')
                                        }
                                    }}
                                    placeholder="그룹명"
                                    className="w-16 text-sm border-none focus:outline-none"
                                    autoFocus
                                />
                                <button onClick={handleAddGroup} className="p-0.5 text-green-600">
                                    <Check size={14} />
                                </button>
                                <button onClick={() => { setIsAddingGroup(false); setNewGroupName('') }} className="p-0.5 text-gray-400">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddingGroup(true)}
                                className="px-2 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-300 border-dashed flex items-center gap-1"
                            >
                                <Plus size={14} />
                                그룹
                            </button>
                        )}
                    </div>
                </div>

                {/* 새 교재 추가 폼 */}
                {showAddForm && (
                    <div className="px-4 py-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                        {/* 템플릿 선택 */}
                        <div className="mb-2 flex items-center gap-2">
                            <FileDown size={14} className="text-gray-500" />
                            <label className="text-xs text-gray-600">템플릿에서 불러오기:</label>
                            <select
                                value={selectedTemplateId || ''}
                                onChange={(e) => handleTemplateSelect(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                                <option value="">직접 입력</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.total_chapters}{t.chapter_unit === '직접입력' ? t.custom_chapter_unit : t.chapter_unit})
                                    </option>
                                ))}
                            </select>
                            {selectedTemplateId && (
                                <button
                                    onClick={() => handleDeleteTemplate(selectedTemplateId, templates.find(t => t.id === selectedTemplateId)?.name || '')}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                    title="템플릿 삭제"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-6 gap-2 items-end">
                            <div className="col-span-2">
                                <label className="block text-xs text-gray-600 mb-1">교재명 *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="교재명 입력"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">단원 수</label>
                                <input
                                    type="number"
                                    value={totalChapters}
                                    onChange={(e) => setTotalChapters(parseInt(e.target.value) || 1)}
                                    min={1}
                                    max={200}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">단위</label>
                                <select
                                    value={chapterUnit}
                                    onChange={(e) => setChapterUnit(e.target.value as any)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value="강">강</option>
                                    <option value="과">과</option>
                                    <option value="Unit">Unit</option>
                                    <option value="Chapter">Chapter</option>
                                    <option value="직접입력">직접입력</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">그룹</label>
                                {activeTab ? (
                                    // 그룹 탭 선택 시 고정 표시
                                    <div className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-700">
                                        {groups.find(g => g.id === activeTab)?.name || '선택됨'}
                                    </div>
                                ) : (
                                    <select
                                        value={selectedGroupId || ''}
                                        onChange={(e) => {
                                            setSelectedGroupId(e.target.value || null)
                                            setSelectedSubgroupId(null)
                                        }}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="">미분류</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            {/* 수준 선택 (그룹이 선택된 경우) */}
                            {selectedGroupId && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">수준</label>
                                    <select
                                        value={selectedSubgroupId || ''}
                                        onChange={(e) => setSelectedSubgroupId(e.target.value || null)}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="">선택안함</option>
                                        {subgroups
                                            .filter(s => s.group_id === selectedGroupId)
                                            .map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}
                            <div>
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className="w-full px-4 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm"
                                >
                                    {isCreating ? '...' : '추가'}
                                </button>
                            </div>
                        </div>
                        
                        {/* 템플릿 선택 시 단원 미리보기 */}
                        {selectedTemplateId && templateChapters.length > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">단원 구조 미리보기:</div>
                                <div className="flex flex-wrap gap-1">
                                    {templateChapters.slice(0, 10).map((ch, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                            {ch.custom_name || `${ch.chapter_number}${chapterUnit === '직접입력' ? customUnit : chapterUnit}`}
                                        </span>
                                    ))}
                                    {templateChapters.length > 10 && (
                                        <span className="px-2 py-0.5 text-gray-400 text-xs">
                                            +{templateChapters.length - 10}개 더
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 교재 목록 또는 메모 추적 뷰 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {showMemoView ? renderMemoView() : (activeTab === null ? renderAllTextbooks() : renderGroupTextbooks())}
                </div>
            </div>

            {/* 메모 입력 모달 */}
            {showMemoModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowMemoModal(false)}>
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={20} className="text-green-600" />
                                <h3 className="font-bold text-gray-900">
                                    {memoModalTarget.type === 'subgroup' ? '수준' : '교재'} 메모
                                </h3>
                                <span className="text-sm text-gray-500">- {memoModalTarget.name}</span>
                            </div>
                            <button
                                onClick={() => setShowMemoModal(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4">
                            <textarea
                                value={memoInput}
                                onChange={e => setMemoInput(e.target.value)}
                                placeholder={`${memoModalTarget.type === 'subgroup' ? '수준에 대한 설명이나 수업 지침' : '교재에 대한 설명이나 특이사항'}을 입력하세요...`}
                                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setShowMemoModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={saveMemo}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 템플릿 저장 모달 */}
            {showSaveTemplateModal && saveTemplateTextbookId && (
                <SaveTemplateModal
                    textbookId={saveTemplateTextbookId}
                    textbooks={textbooks}
                    templateName={templateName}
                    setTemplateName={setTemplateName}
                    onSave={handleSaveTemplate}
                    onClose={() => {
                        setShowSaveTemplateModal(false)
                        setSaveTemplateTextbookId(null)
                        setTemplateName('')
                    }}
                />
            )}
        </div>
    )
}

// 템플릿 저장 모달 컴포넌트
function SaveTemplateModal({
    textbookId,
    textbooks,
    templateName,
    setTemplateName,
    onSave,
    onClose
}: {
    textbookId: string
    textbooks: Textbook[]
    templateName: string
    setTemplateName: (name: string) => void
    onSave: (textbook: Textbook, chapters: TextbookChapter[]) => Promise<void>
    onClose: () => void
}) {
    const textbook = textbooks.find(t => t.id === textbookId)
    const { chapters, loading } = useTextbookChapters(textbookId)
    const [saving, setSaving] = useState(false)

    if (!textbook) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(textbook, chapters)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">템플릿으로 저장</h3>
                
                <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">템플릿 이름</label>
                    <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="템플릿 이름 입력"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        autoFocus
                    />
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">저장될 정보:</div>
                    <ul className="text-sm text-gray-700 space-y-1">
                        <li>• 총 단원 수: {textbook.total_chapters}{textbook.chapter_unit === '직접입력' ? textbook.custom_chapter_unit : textbook.chapter_unit}</li>
                        <li>• 단원 단위: {textbook.chapter_unit === '직접입력' ? textbook.custom_chapter_unit : textbook.chapter_unit}</li>
                        {loading ? (
                            <li>• 단원명: 로딩 중...</li>
                        ) : (
                            <li>• 커스텀 단원명: {chapters.filter(c => c.custom_name).length}개</li>
                        )}
                    </ul>
                </div>

                {!loading && chapters.filter(c => c.custom_name).length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-700 mb-1">커스텀 단원명:</div>
                        <div className="flex flex-wrap gap-1">
                            {chapters.filter(c => c.custom_name).slice(0, 8).map(ch => (
                                <span key={ch.id} className="px-2 py-0.5 bg-blue-100 rounded text-xs text-blue-800">
                                    {ch.chapter_number}: {ch.custom_name}
                                </span>
                            ))}
                            {chapters.filter(c => c.custom_name).length > 8 && (
                                <span className="text-xs text-blue-600">
                                    +{chapters.filter(c => c.custom_name).length - 8}개 더
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !templateName.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                    >
                        {saving ? '저장 중...' : '템플릿 저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}
