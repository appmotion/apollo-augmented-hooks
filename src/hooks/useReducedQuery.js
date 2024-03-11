import { useState, useEffect } from 'react';
import { useApolloClient, useSuspenseQuery, useQuery, skipToken } from '@apollo/client';
import { makeReducedQueryAst } from '../helpers/reducedQueries';
import { registerRequest, deregisterRequest } from '../helpers/inFlightTracking';
import { useGlobalContext } from '../globalContextHook';

// Create a reduced version of the query that contains only the fields that are not in the cache already.
const getQueryAst = (queryAst, client, options) => {
    if (
        // Polling implies the need for fresh data.
        options.pollInterval
        // `cache-only` means we don't want to request anything from the server.
        // `network-only` and `no-cache` imply that we always want to request everything from the server.
        // In either scenario we need to keep the entire query.
        || ['cache-only', 'network-only', 'no-cache'].includes(options.fetchPolicy)
        // Also provide an explicit option to disable query reduction.
        || options.reducedQuery === false
    ) {
        return queryAst;
    }

    return makeReducedQueryAst(client.cache, queryAst, options.variables);
};

export default (useQueryHook, queryAst, options) => {
    const client = useApolloClient();
    const globalContext = useGlobalContext();
    const queryName = queryAst.definitions[0].name?.value || '';

    // Functional default state to avoid recomputing the reduced query on each render.
    const [reducedQueryAst, setReducedQueryAst] = useState(() => (
        getQueryAst(queryAst, client, options)
    ));

    const resetReducedQueries = () => {
        setReducedQueryAst(getQueryAst(queryAst, client, options));
    };

    const skip = !reducedQueryAst || options === skipToken || options.skip;

    // If all the requested data is already in the cache, we can skip this query.
    const queryOptions = skip && useQueryHook === useSuspenseQuery ? skipToken : {
        ...options,
        context: {
            ...globalContext,
            ...options.context,
        },
        skip: skip && useQueryHook === useQuery,
        // This toggles `loading` every time a polling request starts and completes. We need this
        // for the effect hook to work.
        notifyOnNetworkStatusChange: !!options.pollInterval,
    };

    const reducedResult = useQueryHook(reducedQueryAst || queryAst, queryOptions);

    // Remember all the query requests that are currently in flight, so we can ensure that any mutations
    // happening while such a request is in flight updates the cache *after* the request completes and
    // is not overwritten by potentially stale data.
    useEffect(() => {
        if (reducedResult.loading) {
            registerRequest(queryName);
        } else {
            deregisterRequest(queryName);
        }
    }, [reducedResult.loading]);

    useEffect(() => (
        () => {
            deregisterRequest(queryName);
        }
    ), []);

    // Listen for mutation modifiers requesting a reduced query reset. This happens if one or more
    // modifiers returned the DELETE sentinel object.
    useEffect(() => {
        window.addEventListener('reset-reduced-queries', resetReducedQueries);

        return () => {
            window.removeEventListener('reset-reduced-queries', resetReducedQueries);
        };
    }, []);

    // Whenever the query variables change, we need to generate a new reduced query because we are in
    // fact dealing with a new query.
    useEffect(() => {
        resetReducedQueries();
    }, [JSON.stringify(options.variables || {})]);

    return reducedResult;
};
