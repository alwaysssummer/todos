'use client'

import { useTextbooks } from '@/hooks/useTextbooks'
import { useTextbookGroups } from '@/hooks/useTextbookGroups'
import { useTextbookSubgroups } from '@/hooks/useTextbookSubgroups'
import TextbookManagementModal from '@/components/TextbookManagementModal'

export default function TextbookManagementPage() {
  const { 
    textbooks, 
    createTextbook, 
    deleteTextbook, 
    updateTextbookGroup, 
    updateTextbookSubgroup, 
    updateTextbookChapters, 
    updateTextbookLocalPath, 
    updateTextbookMemo, 
    updateTextbookName, 
    reorderTextbooks,
    updateTextbookFavorite,
  } = useTextbooks()
  
  const { 
    groups, 
    createGroup, 
    updateGroup, 
    deleteGroup, 
    reorderGroups 
  } = useTextbookGroups()
  
  const { 
    subgroups, 
    createSubgroup, 
    updateSubgroup, 
    deleteSubgroup, 
    reorderSubgroups 
  } = useTextbookSubgroups()

  const handleClose = () => {
    // 새 창이므로 창을 닫음
    window.close()
  }

  return (
    <TextbookManagementModal
      onClose={handleClose}
      textbooks={textbooks}
      groups={groups}
      subgroups={subgroups}
      onCreateTextbook={createTextbook}
      onDeleteTextbook={deleteTextbook}
      onUpdateTextbookGroup={updateTextbookGroup}
      onUpdateTextbookSubgroup={updateTextbookSubgroup}
      onUpdateTextbookChapters={updateTextbookChapters}
      onUpdateTextbookLocalPath={updateTextbookLocalPath}
      onUpdateTextbookMemo={updateTextbookMemo}
      onUpdateTextbookName={updateTextbookName}
      onReorderTextbooks={reorderTextbooks}
      onCreateGroup={createGroup}
      onUpdateGroup={updateGroup}
      onDeleteGroup={deleteGroup}
      onReorderGroups={reorderGroups}
      onCreateSubgroup={createSubgroup}
      onUpdateSubgroup={updateSubgroup}
      onDeleteSubgroup={deleteSubgroup}
      onReorderSubgroups={reorderSubgroups}
      onUpdateTextbookFavorite={updateTextbookFavorite}
      isStandalonePage={true}
    />
  )
}


