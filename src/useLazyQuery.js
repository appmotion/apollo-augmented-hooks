import { gql, useLazyQuery, useApolloClient } from '@apollo/client';
import { useGlobalContext } from './globalContextHook';
import { handleModifiers } from './helpers/modifiers';

export default (query, options = {}) => {
    const client = useApolloClient();
    const globalContext = useGlobalContext();
    const queryAst = typeof query === 'string' ? gql(query) : query;

    return useLazyQuery(queryAst, {
        ...options,
        client,
        context: {
            ...globalContext,
            ...options.context,
        },
        onCompleted: (data) => {
            if (options.onCompleted) {
                options.onCompleted(data);
            }

            // Simplify cache updates after lazy query executions.
            handleModifiers(client.cache, data, options.modifiers);
        },
    });
};
