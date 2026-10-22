Use `Pagination` in the `footer` of the Card that holds the Table.

```jsx
<Card padded={false} footer={<Pagination page={2} pageCount={7} total={168} onChange={setPage} />}> … </Card>
```
