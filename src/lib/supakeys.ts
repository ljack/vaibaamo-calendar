import { createPasskeyAuth } from 'supakeys'
import { getSupabase } from './supabase'

export const getPasskeys = () => {
    const supabase = getSupabase()

    // Use hostname as rpId. 
    // Note: Passkeys are domain-bound. 
    // Keys registered on localhost won't work on production and vice-versa.
    const rpId = window.location.hostname

    return createPasskeyAuth(supabase, {
        rpId,
        rpName: 'Vaibaamo Calendar',
    })
}
