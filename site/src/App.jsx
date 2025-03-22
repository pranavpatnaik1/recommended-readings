import React, { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

function App() {
  // State for books
  const [books, setBooks] = useState([]);
  // Add loading state
  const [loading, setLoading] = useState(true);
  // Add state to track submission status
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    genre: '',
    notes: '',
    submittedBy: ''
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Notification state
  const [showNotification, setShowNotification] = useState(false);
  
  // Modal state for book details
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // Fetch books from Supabase when component mounts
  useEffect(() => {
    fetchBooks();
    
    // Setup a real-time subscription for changes to the books table
    const subscription = supabase
      .channel('books-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'books' }, 
        payload => {
          console.log('Change received!', payload);
          fetchBooks();
        }
      )
      .subscribe();
    
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Function to fetch approved books from Supabase
  const fetchBooks = async () => {
    try {
      setLoading(true);
      console.log('Fetching books from Supabase...');
      
      // First check if we can access any table
      console.log('Testing connection...');
      const { data: testData, error: testError } = await supabase
        .from('books')
        .select('count');
      
      console.log('Connection test result:', { testData, testError });
      
      // If there's an error with the test query, it means the table doesn't exist
      if (testError) {
        if (testError.code === '42P01') { // PostgreSQL code for undefined_table
          console.error('The "books" table does not exist!');
          throw new Error('Books table does not exist. Please create it in your Supabase dashboard.');
        } else {
          console.error('Supabase error:', testError);
          throw testError;
        }
      }
      
      // Try getting all books regardless of approval status
      console.log('Fetching all books (without filter)...');
      const { data: allBooks, error: allBooksError } = await supabase
        .from('books')
        .select('*');
      
      console.log('All books:', allBooks);
      
      if (allBooksError) {
        console.error('Error fetching all books:', allBooksError);
      } else if (allBooks && allBooks.length === 0) {
        console.log('Your books table exists but is empty. Please add some records.');
      } else {
        console.log(`You have ${allBooks.length} total books, but none might be approved.`);
        
        // Check if the approved column exists
        if (allBooks && allBooks.length > 0) {
          const firstBook = allBooks[0];
          console.log('First book structure:', firstBook);
          if ('approved' in firstBook) {
            console.log('The "approved" column exists.');
          } else {
            console.log('The "approved" column DOES NOT exist! Available columns:', Object.keys(firstBook));
          }
        }
      }
      
      // Now try the original query with the approval filter
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error with approved filter:', error);
        throw error;
      }
      
      console.log('Fetched approved books:', data);
      console.log('Number of approved books:', data ? data.length : 0);
      
      if (data) {
        setBooks(data);
      }
    } catch (error) {
      console.error('Error fetching books:', error.message);
      // Fallback to local sample data if Supabase connection fails
      const initialBooks = [
        { id: 1, title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Classic", notes: "A powerful story about racial injustice", submittedBy: "John Doe" },
        { id: 2, title: "1984", author: "George Orwell", genre: "Dystopian", notes: "A cautionary tale about totalitarianism", submittedBy: "Jane Smith" },
        { id: 3, title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Classic", notes: "Explores themes of wealth and the American Dream", submittedBy: "Robert Johnson" }
      ];
      setBooks(initialBooks);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewBook({
      ...newBook,
      [name]: value
    });
  };

  // Update the handleSubmit function to use our new animation approach
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author) {
      alert('Title and author are required.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Create new book object with approved set to false by default
      const submission = {
        ...newBook,
        approved: false
      };
      
      console.log('Submitting book:', submission);
      
      // Insert into Supabase
      const { data, error } = await supabase
        .from('books')
        .insert([submission])
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      
      console.log('Book submitted successfully:', data);
      
      // Show notification with fade-in class
      setShowNotification('notification-enter');
      
      // After a short delay, add the fade-out class
      setTimeout(() => {
        setShowNotification('notification-exit');
        
        // Then remove the notification completely after animation completes
        setTimeout(() => {
          setShowNotification(false);
        }, 1000); // Match this to the duration of the fade-out animation
      }, 2000); // Show the notification for 2 seconds before starting fade-out
      
      // Reset form
      setNewBook({
        title: '',
        author: '',
        genre: '',
        notes: '',
        submittedBy: ''
      });
      
      // Refresh books list
      fetchBooks();
    } catch (error) {
      console.error('Error submitting book:', error.message);
      alert('There was an error submitting your recommendation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal functions
  const openBookModal = (book) => {
    // Get the current width of the body
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // If there's a scrollbar, add padding to keep the content from shifting
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    
    // Disable scrolling but in a way that doesn't cause layout shift
    document.body.style.overflow = 'hidden';
    
    // Set state for the modal
    setSelectedBook(book);
    setModalOpen(true);
  };

  const closeBookModal = () => {
    // Reset the padding
    document.body.style.paddingRight = '0';
    
    // Re-enable scrolling
    document.body.style.overflow = 'auto';
    
    // Close the modal
    setModalOpen(false);
  };

  // Filter books based on search term
  const filteredBooks = books.filter(book => 
    book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.genre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.submittedBy?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app">
      <header className="header">
        <h1>pranav's library</h1>
        <p>crowdsourced book discovery for the curious mind.</p>
      </header>

      <main>
        <section className="search-section">
          <input
            type="text"
            placeholder="search books..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </section>

        <hr />

        <section className="book-table-section">
          <h2>reading list</h2>
          <div className="table-container">
            {loading ? (
              <div className="loading">Loading books...</div>
            ) : (
              <table className="book-table">
                <thead>
                  <tr>
                    <th>title</th>
                    <th>author</th>
                    <th className="responsive-hide-sm">tags</th>
                    <th className="responsive-hide-sm">contributor</th>
                    <th>notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.length > 0 ? (
                    filteredBooks.map(book => (
                      <tr key={book.id}>
                        <td>{book.title}</td>
                        <td>{book.author}</td>
                        <td className="responsive-hide-sm tags-cell">
                          <div className="tags-wrapper">
                            {book.genre?.split(',').map((tag, index) => 
                              tag.trim() && (
                                <span key={index} className="tag">
                                  {tag.trim().toLowerCase()}
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="responsive-hide-sm"><span className='submitter'>{book.submittedBy}</span></td>
                        <td>
                          <div className="notes-container">
                            <span className="notes-text">{book.notes}</span>
                            <button 
                              className="view-details-btn"
                              onClick={() => openBookModal(book)}
                              aria-label="View details"
                            >
                              (...)
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="no-books">
                        {searchTerm ? "No books found matching your search." : "No books available yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {showNotification && (
          <div className={`notification ${showNotification}`}>
            Thank you for contributing. Your recommendation will be reviewed soon.
          </div>
        )}

        <section className="add-book-section">
          <h2>submit a recommendation</h2>
          <form onSubmit={handleSubmit} className="book-form">
            <div className="form-group">
              <label htmlFor="title">title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={newBook.title}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="author">author *</label>
              <input
                type="text"
                id="author"
                name="author"
                value={newBook.author}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="genre">tags (separate by commas)</label>
              <input
                type="text"
                id="genre"
                name="genre"
                value={newBook.genre}
                onChange={handleInputChange}
                placeholder="math, ai/ml, research"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="submittedBy">contributor</label>
              <input
                type="text"
                id="submittedBy"
                name="submittedBy"
                value={newBook.submittedBy}
                onChange={handleInputChange}
                placeholder='ex: "John Doe"'
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">notes</label>
              <textarea
                id="notes"
                name="notes"
                value={newBook.notes}
                onChange={handleInputChange}
                rows="3"
                disabled={isSubmitting}
                placeholder='ex: "a must-read for anyone interested in machine learning"'
              ></textarea>
            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'submitting...' : 'submit'}
            </button>
          </form>
        </section>
      </main>

      {/* Book Details Modal */}
      {modalOpen && selectedBook && (
        <div className="modal-overlay" onClick={closeBookModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeBookModal}>×</button>
            <div className="modal-book-info">
              <h3 className="modal-book-title">{selectedBook.title}</h3>
              <h4 className="modal-book-author">by {selectedBook.author}</h4>
              
              {/* Show tags in modal (visible on all screen sizes) */}
              <div className="modal-tags-container">
                {selectedBook.genre?.split(',').map((tag, index) => 
                  tag.trim() && (
                    <span key={index} className="tag">
                      {tag.trim().toLowerCase()}
                    </span>
                  )
                )}
              </div>
              
              {/* Show submitted by in modal (visible on all screen sizes) */}
              <p className="modal-submitted-by">submitted by: {selectedBook.submittedBy}</p>
              
              <div className="modal-book-notes">
                <h5>notes</h5>
                <p>{selectedBook.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>created by <a href="https://instagram.com/pranavpatnaik_/">@pranavpatnaik_</a>, {new Date().getFullYear()}.</p>
      </footer>
    </div>
  );
}

export default App;