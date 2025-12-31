export interface Profile {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: 'admin' | 'user'
    updated_at: string | null
}

export interface MediaAsset {
    url: string
    type: 'image' | 'video'
    caption?: string
    section: 'plan' | 'recap'
}

export interface Event {
    id: string
    title: string
    description: string | null
    start_time: string
    end_time: string
    location: string | null
    max_participants: number | null
    created_at: string
    creator_id?: string | null
    plan_markdown?: string | null
    recap_markdown?: string | null
    media_assets?: MediaAsset[]
}

export interface Participant {
    id: string
    event_id: string
    user_id: string
    status: 'registered' | 'waitlist' | 'cancelled'
    created_at: string
}
