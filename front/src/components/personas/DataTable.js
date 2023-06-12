import DataTable from 'react-data-table-component';
import React from 'react';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import { DeletePerson } from '../ApiHandler';


const FilterComponent = ({ filterText, onFilter, onClear }) => (
		
	<InputGroup>
	  <Form.Control 
		  id="search"
		  type="text"
		  placeholder="Buscar por nombre..."
		  value={filterText}
		  onChange={onFilter} />
	  <Button variant="outline-secondary" onClick={onClear}>x</Button>
	</InputGroup>
  

);

const columns = [
	{
		name: 'ID',
		selector: row => row.id,
		sortable: true,
	},
	{
		name: 'Nombre',
		selector: row => row.nombre,
		sortable: true,
	},
	{
		name: 'Email',
		selector: row => row.email,
		sortable: false,
	},
	{
		name: 'DNI',
		selector: row => row.dni,
		sortable: true,
	}
	
];

export const DataPersonTable = ({data,setPeople,type}) => {
  
    
	const [filterText, setFilterText] = React.useState('');
	const [resetPaginationToggle, setResetPaginationToggle] = React.useState(false);
  	const [selectedRows, setSelectedRows] = React.useState([]);
	const [toggleCleared, setToggleCleared] = React.useState(false);
	
	const handleRowSelected = React.useCallback(state => {
		setSelectedRows(state.selectedRows);
	}, []);

	const filteredItems = data.filter(
		item => item.nombre && item.nombre.toLowerCase().includes(filterText.toLowerCase()),
	);
  const contextActions = React.useMemo(() => {
		const handleDelete = () => {
			
			if (window.confirm(`Estas seguro que quieres borrar:\r ${selectedRows.map(r => r.nombre)}?`)) {
				setToggleCleared(!toggleCleared);
				setPeople(data.filter(r => !selectedRows.includes(r)));
        		selectedRows.map(r => DeletePerson(r.id));
        		
			}
		};

		return (
			<Button key="delete" onClick={handleDelete} variant="danger" >
				Delete
			</Button>
		);
	}, [data, selectedRows, toggleCleared,setPeople]);

	const subHeaderComponentMemo = React.useMemo(() => {
		const handleClear = () => {
			if (filterText) {
				setResetPaginationToggle(!resetPaginationToggle);
				setFilterText('');
			}
		};

		return (
			<FilterComponent onFilter={e => setFilterText(e.target.value)} onClear={handleClear} filterText={filterText} />
		);
	}, [filterText, resetPaginationToggle]);

	return (
    <div className='container mt-3'>
      <DataTable
			title={type}
			columns={columns}
			data={filteredItems}
			pagination
			paginationResetDefaultPage={resetPaginationToggle} // optionally, a hook to reset pagination to page 1
			subHeader
			subHeaderComponent={subHeaderComponentMemo}
			selectableRows
			persistTableHead
      		contextActions={contextActions}
			onSelectedRowsChange={handleRowSelected}
			clearSelectedRows={toggleCleared}
			
		/>
    </div>
		
	);
}

