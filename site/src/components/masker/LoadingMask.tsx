import React from 'react';
import { Backdrop, CircularProgress, Typography } from '@mui/material';

export interface LoadingMaskProps {
  loading: boolean;
  children: React.ReactNode;
  opaque?: boolean;
  delayRender?: boolean;
  text?: string;
}

/**
 * Simple reusable component used to mask all of its children while content is loading
 *
 * @param loading {boolean} controls whether the masker is shown
 * @param children {React.ReactNode} the content that should be masked
 * @param opaque {boolean} controls whether the mask is opaque and hides it's children
 * @param delayRender {boolean} controls whether the children should be added to the dom while loading
 * @param text {string} optional text to show below the loading indicator
 * @constructor
 */
const LoadingMask: React.FC<LoadingMaskProps> = ({
  loading,
  children,
  opaque = false,
  delayRender = false,
  text,
}: LoadingMaskProps) => (
  <>
    <Backdrop
      id="Backdrop"
      sx={(backDropTheme) => ({
        color: '#secondary.main',
        ...(opaque && {
          backgroundColor: 'background.default',
        }),

        // 98 was chosen because it is one less than 99, which is used by the site header.
        // Previously I only added 1, but because the page sidebar is also +1, it does not
        // get masked when trying to mask a <Page>.
        zIndex: backDropTheme.zIndex.drawer + 98,
      })}
      open={loading}
    >
      <CircularProgress color="inherit" />
      {text && (
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {text}
        </Typography>
      )}
    </Backdrop>

    {(!delayRender || !loading) && children}
  </>
);

export default LoadingMask;
