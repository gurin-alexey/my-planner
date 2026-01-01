import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ijbhaxxuctkhckuvoqrr.supabase.co'
const supabaseKey = 'sb_publishable_xb8zbTbAaEVPvmJlBWHDRg_uKNyHg-r'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupPersonalLists() {
    console.log('Starting setup of personal lists...')

    // 1. Find or create "ЛИЧНОЕ" folder
    let { data: folders, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('name', 'ЛИЧНОЕ')

    let folderId
    if (folderError || !folders || folders.length === 0) {
        console.log('Folder "ЛИЧНОЕ" not found, creating...')
        const { data: newFolder, error: createFolderError } = await supabase
            .from('folders')
            .insert([{ name: 'ЛИЧНОЕ' }])
            .select()
            .single()

        if (createFolderError) {
            console.error('Error creating folder:', createFolderError)
            return
        }
        folderId = newFolder.id
    } else {
        folderId = folders[0].id
    }

    console.log(`Using Folder ID: ${folderId}`)

    // 2. Define lists to create
    const listsToCreate = [
        'ЦЕЛИ 2026',
        'ЦЕЛИ',
        'КУПИТЬ',
        'ЗАДАЧИ',
        'КАЧЕСТВА',
        'РЕЧИ',
        'САША',
        'ОТЕЦ',
        'ДРУЗЬЯ',
        'ДОМ',
        'АВТО',
        'ЛИЧНОЕ ИЗУЧЕНИЕ',
        'МОЛИТВЫ',
        'ПИТАНИЕ',
        'СПОРТ',
        'ХОББИ, ОТДЫХ'
    ]

    // 3. Create lists
    for (const name of listsToCreate) {
        const { data: existingLists } = await supabase
            .from('lists')
            .select('id')
            .eq('name', name)
            .eq('folder_id', folderId)

        if (!existingLists || existingLists.length === 0) {
            console.log(`Creating list: ${name}`)
            const { error: listError } = await supabase
                .from('lists')
                .insert([{ name, folder_id: folderId }])

            if (listError) {
                console.error(`Error creating list ${name}:`, listError)
            }
        } else {
            console.log(`List ${name} already exists in "ЛИЧНОЕ"`)
        }
    }

    console.log('Setup complete!')
}

setupPersonalLists()
