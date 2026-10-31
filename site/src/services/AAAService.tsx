import axios, { AxiosError } from 'axios';
import type { aaaRequest, aaaResponse } from '../types';
import type { TranslationKey } from '../i18n';

/** Profile fields the AAA users API accepts in a PATCH, matching the EODMS CLI. */
export interface UserProfileFields {
    given_name?: string;
    surname?: string;
    email?: string;
    address?: UserAddressRequest;
    billing_address?: UserAddressRequest;
    shipping_address?: UserAddressRequest;
    language?: string;
}

export interface UserAddressRequest {
    'street-address'?: string;
    city?: string;
    province?: string;
    country?: string;
    'postal-code'?: string;
}

export interface CreateUserAccountPayload {
    username: string;
    password: string;
    given_name: string;
    surname: string;
    email: string;
    language: 'English' | 'French';
}

/** Creates an account through the public AAA users endpoint. */
export const createUserAccount = async (usersEndpoint: string, payload: CreateUserAccountPayload): Promise<unknown> =>
    (await axios.post(usersEndpoint, payload, { withCredentials: true })).data;

const userUrl = (usersEndpoint: string, username: string) =>
    `${usersEndpoint.replace(/\/+$/, '')}/${encodeURIComponent(username)}`;

/**
 * Retrieves the signed-in user's profile from the AAA users API.
 */
export const getUserProfile = async (usersEndpoint: string, username: string, accessToken: string): Promise<unknown> => {
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    return (await axios.get(userUrl(usersEndpoint, username), { headers, withCredentials: true })).data;
}

/**
 * Updates profile fields, or the password, through the AAA users API.
 */
export const updateUserProfile = async (usersEndpoint: string, username: string, accessToken: string,
    patch: UserProfileFields | { password: string }): Promise<unknown> => {
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    return (await axios.patch(userUrl(usersEndpoint, username), patch, { headers, withCredentials: true })).data;
}

const pick = (source: unknown, ...path: string[]) => path.reduce<unknown>((value, key) =>
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, source);

// Non-text values (e.g. a structured address) come back undefined so they are left alone.
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : undefined;

const readAddressObject = (candidate: unknown): UserAddressRequest | undefined => {
    if (typeof candidate === 'string') return { 'street-address': candidate };
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;

    const source = candidate as Record<string, unknown>;
    const address: UserAddressRequest = {};
    for (const field of ['street-address', 'city', 'province', 'country', 'postal-code'] as const) {
        if (typeof source[field] === 'string') address[field] = source[field] as string;
    }
    return address;
};

/**
 * Flattens a profile response, nested (`personal-information`) or flat, into patchable fields.
 */
export function readUserProfile(profile: unknown): UserProfileFields {
    const personal = ['personal-information'];
    const name = ['personal-information', 'identification', 'name'];
    const contact = ['personal-information', 'contact-information'];
    const mainAddress = pick(profile, ...contact, 'address') ?? pick(profile, ...personal, 'address') ?? pick(profile, 'address');
    const legacyAddressArray = Array.isArray(mainAddress) ? mainAddress : [];
    const legacyAddress = (type: 'main' | 'billing' | 'shipping') => legacyAddressArray.find(item =>
        !!item && typeof item === 'object' && (item as Record<string, unknown>)['@type'] === type,
    );
    return {
        given_name: text(pick(profile, ...name, 'given-name') ?? pick(profile, ...personal, 'given_name') ?? pick(profile, 'given_name')),
        surname: text(pick(profile, ...name, 'surname') ?? pick(profile, ...personal, 'surname') ?? pick(profile, 'surname')),
        email: text(pick(profile, ...contact, 'email') ?? pick(profile, ...personal, 'email') ?? pick(profile, 'email')),
        address: readAddressObject(Array.isArray(mainAddress) ? legacyAddress('main') : mainAddress),
        billing_address: readAddressObject(
            pick(profile, ...contact, 'billing_address') ?? pick(profile, ...personal, 'billing_address') ?? pick(profile, 'billing_address') ?? legacyAddress('billing'),
        ),
        shipping_address: readAddressObject(
            pick(profile, ...contact, 'shipping_address') ?? pick(profile, ...personal, 'shipping_address') ?? pick(profile, 'shipping_address') ?? legacyAddress('shipping'),
        ),
        language: text(pick(profile, 'personal-information', 'language') ?? pick(profile, 'language')),
    };
}

/**
 * Maps a users API error to a message key, plus the server's own message for request errors.
 */
export function handleUserProfileError(error: AxiosError): { key: TranslationKey; detail?: string } {
    const status = error.response?.status;
    if (status === 401 || status === 403) return { key: 'errorCredentialsExpired' };
    const key = (handleAAAError(error) ?? 'profileRequestFailed') as TranslationKey;
    if (!status || status < 400 || status >= 500 || status === 429) return { key };
    const data = error.response?.data;
    const detail = [pick(data, 'message'), pick(data, 'error'), pick(data, 'detail')]
        .find((value): value is string => typeof value === 'string' && value.length > 0);
    return { key, detail };
}

/**
 * Retrieves a login token from the AAA service
 * 
 * @param authEndpoint Login URL
 * @param username Username
 * @param password Password
 * @returns the body of the response
 */
export const getAuthenticationToken = async(authEndpoint:string, username:string, password:string) => {
    const requestBody: aaaRequest = {
        grant_type: "password",
         username: username,
         password: password,
         withCredentials: true,
    }  

    return (await axios.post(authEndpoint, requestBody, {withCredentials: true})).data;
}

/**
 * Retrieve a new login token by using the refresh token as authentication
 * 
 * @param refreshEndpoint Token refresh URL
 * @param refreshToken refresh token
 * @returns the body of the response
 */
export const refreshAuthenticationToken = async(refreshEndpoint:string, refreshToken:string): Promise<aaaResponse> => {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${refreshToken}` };
    return (await axios.get(refreshEndpoint, { headers, withCredentials: true })).data;
}

/**
 * Check if authentication token has expired or if it is null
 * 
 * @param authExpiry expiry time of token, or null if unauthenticated
 * @returns true/false if required or not
 */
export function isRefreshRequired(authExpiry:string|null) {
    const currentTime = new Date();
    if(authExpiry && currentTime >= new Date(authExpiry)) {
        return true;
    }
    return false;
}

/**
 * Check if refresh token has expired
 * 
 * @param refreshExpiry expriy time of token
 * @returns true/false if expired
 */
export function isRefreshTokenExpired(refreshExpiry:string) {
    const currentTime = new Date();
    if(currentTime < new Date(refreshExpiry)) {
        return false;
    }
    return true;
}

/**
 * Determines what type of error was sent from the AAA service and sets the error message on this panel.
 * 
 * @param error any object, will be type checked to determine if an AxiosError.
 * @returns A string with the error message key or null if unknown
 */
export function handleAAAError(error:AxiosError): string | null {

    if(error.response) {
        // error response received from AAA - handle known error codes
        if(error.response.status == 400) {
            return 'errorBadRequest';
        } else if(error.response.status == 401) {
            return 'errorUserPass';
        } else if(error.response.status == 429) {
            return 'errorTooManyRequests';
        } else if(error.response.status == 500) {
            return 'errorInternalServer';
        } else if(error.response.status == 503) {
            return 'errorUnavailable';
        } else if(error.response.status == 504) {
            return 'errorTimedOut';
        }
    } else{
        // no response received - inform AAA unreachable
        return 'errorUnreachableAAA';
    }

    return null;
}
