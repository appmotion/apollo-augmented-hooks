import { useRef, useEffect } from 'react';
import { DocumentNode, gql, OperationVariables, QueryHookOptions, QueryResult, TypedDocumentNode } from '@apollo/client';
import { getVariablesWithPagination, handleNextPage } from './helpers/pagination';
import useReducedQuery from './hooks/useReducedQuery';
import useCacheQuery from './hooks/useCacheQuery';

interface AugmentedQueryHookOptions extends QueryHookOptions {
    reducedQuery: boolean,
    dataMap: any,
    pagination: any,
}

interface AugmentedQueryResult extends QueryResult {
    nextPage: () => Promise<any>,
}

export default function <TData = any, TVariables = OperationVariables> (
    query: DocumentNode | TypedDocumentNode<TData, TVariables> | string,
    options?: AugmentedQueryHookOptions
): AugmentedQueryResult {
    const queryAst = typeof query === 'string' ? gql(query) : query;
    const variables = getVariablesWithPagination(options);
    const reducedResult = useReducedQuery(queryAst, variables, options);
    const cacheData = useCacheQuery(queryAst, variables, options);
    const cacheDataRef = useRef(cacheData);

    useEffect(() => {
        // Store cache result in ref so its contents remain fresh when calling `nextPage`.
        cacheDataRef.current = cacheData;
    });

    return {
        ...reducedResult,
        nextPage: handleNextPage(queryAst, cacheDataRef, reducedResult, options.pagination),
        data: cacheData,
        // XXX: Make the loading state dependent on the presence of data in the cache query result.
        // This is a workaround for https://github.com/apollographql/react-apollo/issues/2601
        loading: !options.skip && !cacheData,
    };
}
