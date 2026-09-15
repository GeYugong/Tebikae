import { createContext, useContext } from 'react';

export const PwaUpdateContext = createContext({ available: false, update: async () => {} });
export const usePwaUpdate = () => useContext(PwaUpdateContext);
