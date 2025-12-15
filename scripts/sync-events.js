
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env')
        const envContent = await fs.readFile(envPath, 'utf-8')
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=')
            if (key && value) {
                process.env[key.trim()] = value.trim()
            }
        })
    } catch (e) {
        console.log('Could not load .env file, assuming env vars are set')
    }
}

async function syncEvents() {
    await loadEnv()

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.sync_events_key || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY')
        process.exit(1)
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.sync_events_key) {
        console.warn('WARNING: Using Anon Key. This will likely fail due to RLS policies unless RLS is disabled or policy allows anon inserts.')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read events.json
    const eventsPath = path.resolve(__dirname, '../events.json')
    const eventsData = JSON.parse(await fs.readFile(eventsPath, 'utf-8'))

    console.log(`Read ${eventsData.length} events from ${eventsPath}`)

    for (const event of eventsData) {
        // We use title as the unique key for upsert logic if we want to update existing ones.
        // However, Supabase upsert requires a unique constraint on the column(s).
        // Standard ID is UUID. If we want to upsert by title, title must be unique.
        // For now, let's try to find if it exists by title, then update or insert.

        const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('title', event.title)
            .single()

        const payload = {
            title: event.title,
            description: event.description,
            start_time: event.start_time_placeholder,
            end_time: new Date(new Date(event.start_time_placeholder).getTime() + 3600000).toISOString(), // +1 hour
            location: event.place
        }

        if (existing) {
            console.log(`Updating event: ${event.title}`)
            const { error } = await supabase
                .from('events')
                .update(payload)
                .eq('id', existing.id)

            if (error) console.error(`Error updating ${event.title}:`, error)
        } else {
            console.log(`Creating event: ${event.title}`)
            const { error } = await supabase
                .from('events')
                .insert(payload)

            if (error) console.error(`Error creating ${event.title}:`, error)
        }
    }

    console.log('Sync complete.')
}

syncEvents()
