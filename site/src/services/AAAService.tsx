import axios, { AxiosError } from 'axios';
import type { aaaRequest, aaaResponse } from '../types';

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
