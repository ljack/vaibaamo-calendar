export interface Profile {
    id: string
    full_name: string | null
    display_name: string | null
    first_name: string | null
    last_name: string | null
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
    scheduling_status?: 'voting' | 'locked' | null
    event_type?: 'public' | 'hidden' | 'invite' | null
    access_code?: string | null
    time_type?: 'timestamp' | 'all_day' | 'all_day_multi' | null
}

export interface EventOption {
    id: string
    event_id: string
    start_time: string
    end_time: string
    created_at: string
    time_type?: 'timestamp' | 'all_day' | 'all_day_multi' | null
}

export interface EventVote {
    id: string
    option_id: string
    user_id: string
    created_at: string
}

export interface Participant {
    id: string
    event_id: string
    user_id: string
    status: 'registered' | 'waitlist' | 'cancelled'
    display_name: string | null
    created_at: string
}
